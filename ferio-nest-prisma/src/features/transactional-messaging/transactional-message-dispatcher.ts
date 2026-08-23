import { Injectable } from '@nestjs/common';
import {
  CommerceMessageAttemptStatus,
  CommerceMessageChannel,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '@app/database';
import { MessageAdapterRegistry } from './adapters/message-adapter.registry';

@Injectable()
export class TransactionalMessageDispatcher {
  constructor(
    private readonly prisma: PrismaService,
    private readonly adapters: MessageAdapterRegistry,
  ) {}

  async execute(messageId: string) {
    const claimed = await this.prisma.commerceMessage.updateMany({
      where: { id: messageId, status: 'QUEUED', lockedAt: null },
      data: { status: 'PROCESSING', lockedAt: new Date(), lastError: null },
    });
    if (claimed.count === 0) return { messageId, skipped: true };

    const [message, policy] = await Promise.all([
      this.prisma.commerceMessage.findUniqueOrThrow({
        where: { id: messageId },
        include: { attempts: { orderBy: { attemptNumber: 'asc' } } },
      }),
      this.prisma.commerceMessagingPolicy.findUnique({
        where: { id: 'transactional-default' },
      }),
    ]);

    if (!policy?.enabled || policy.channelPriority.length === 0) {
      return this.block(messageId, 'Transactional routing policy is disabled');
    }

    const channelPlan =
      message.channelPlan.length > 0
        ? message.channelPlan
        : policy.channelPriority;
    if (message.channelPlan.length === 0) {
      await this.prisma.commerceMessage.update({
        where: { id: messageId },
        data: { channelPlan, routingPolicyVersion: policy.version },
      });
    }

    let fallbackReason: string | null = message.fallbackReason;
    for (let index = 0; index < channelPlan.length; index += 1) {
      const channel = channelPlan[index];
      const attemptNumber = message.attempts.length + index + 1;
      const attempt = await this.prisma.commerceMessageAttempt.create({
        data: {
          messageId,
          attemptNumber,
          channel,
          provider:
            this.adapters.readiness().find((item) => item.channel === channel)
              ?.provider ?? 'UNCONFIGURED',
          requestPayload: {
            templateKey: message.templateKey,
            templateVersion: message.templateVersion,
            recipient: message.recipient,
          },
        },
      });

      let result;
      try {
        result = await this.adapters.dispatch(channel, {
          recipient: message.recipient,
          templateKey: message.templateKey,
          templateVersion: message.templateVersion,
          subject: message.renderedSubject,
          body: message.renderedBody,
          payload: message.payload,
          idempotencyKey: `${message.deduplicationKey}:${channel}`,
        });
      } catch (error) {
        result = {
          status: 'UNKNOWN' as const,
          errorCode: 'PROVIDER_OUTCOME_UNKNOWN',
          errorMessage:
            error instanceof Error
              ? error.message
              : 'Provider outcome is unknown',
        };
      }

      const attemptStatus = result.status as CommerceMessageAttemptStatus;
      await this.prisma.commerceMessageAttempt.update({
        where: { id: attempt.id },
        data: {
          status: attemptStatus,
          providerMessageId: result.providerMessageId,
          responsePayload: this.json(result.response),
          errorCode: result.errorCode,
          errorMessage: result.errorMessage,
          completedAt: new Date(),
        },
      });

      if (result.status === 'ACCEPTED' || result.status === 'DELIVERED') {
        return this.prisma.commerceMessage.update({
          where: { id: messageId },
          data: {
            selectedChannel: channel,
            status: result.status === 'DELIVERED' ? 'DELIVERED' : 'SENT',
            sentAt: new Date(),
            deliveredAt: result.status === 'DELIVERED' ? new Date() : undefined,
            completedAt: new Date(),
            fallbackReason,
            terminalReason: null,
          },
        });
      }

      if (result.status === 'UNKNOWN') {
        return this.block(
          messageId,
          'Provider outcome is uncertain; automatic fallback stopped to avoid duplicate delivery',
        );
      }

      fallbackReason = `${channel}:${result.errorCode ?? 'DEFINITIVE_FAILURE'}`;
      const hasNext = index + 1 < channelPlan.length;
      if (!policy.fallbackOnDefinitiveFailure || !hasNext) {
        return this.fail(messageId, fallbackReason);
      }
      await this.prisma.commerceMessage.update({
        where: { id: messageId },
        data: { fallbackReason },
      });
    }

    return this.fail(
      messageId,
      fallbackReason ?? 'No channel could accept the message',
    );
  }

  private block(messageId: string, reason: string) {
    return this.prisma.commerceMessage.update({
      where: { id: messageId },
      data: {
        status: 'BLOCKED',
        terminalReason: reason,
        lastError: reason,
        failedAt: new Date(),
        completedAt: new Date(),
      },
    });
  }

  private fail(messageId: string, reason: string) {
    return this.prisma.commerceMessage.update({
      where: { id: messageId },
      data: {
        status: 'FAILED',
        terminalReason: reason,
        lastError: reason,
        failedAt: new Date(),
        completedAt: new Date(),
      },
    });
  }

  private json(value: unknown): Prisma.InputJsonValue | undefined {
    return value === undefined ? undefined : (value as Prisma.InputJsonValue);
  }
}
