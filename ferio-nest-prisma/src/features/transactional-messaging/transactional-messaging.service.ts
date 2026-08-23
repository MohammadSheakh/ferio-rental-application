import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CommerceMessageChannel, Prisma } from '@prisma/client';
import { StructuredLogger, type UserPayload } from '@app/common';
import { PrismaService } from '@app/database';
import { AuditService } from '../audit/audit.service';
import {
  TransactionalMessageQueryDto,
  UpdateMessageTemplateDto,
  UpdateMessagingPolicyDto,
} from './dto/transactional-message.dto';
import { MessageAdapterRegistry } from './adapters/message-adapter.registry';
import {
  buildMessageDeduplicationKey,
  commerceTemplateDefinitions,
  definitionForTemplateKey,
  maskMessageRecipient,
  renderMessageTemplate,
  templateForCommerceEvent,
  validateMessageTemplate,
} from './transactional-message.util';

export type EnqueueCommerceMessageInput = {
  eventType: string;
  recipient: string;
  referenceType: string;
  referenceId: string;
  occurrenceKey?: string;
  payload?: Prisma.InputJsonValue;
};

@Injectable()
export class TransactionalMessagingService {
  private readonly logger = new StructuredLogger(
    TransactionalMessagingService.name,
  );

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly adapters: MessageAdapterRegistry,
  ) {}

  async enqueueAfterCommit(input: EnqueueCommerceMessageInput): Promise<void> {
    if (!input.recipient) return;
    const templateKey = templateForCommerceEvent(input.eventType);
    if (!templateKey) return;
    try {
      const definition = definitionForTemplateKey(templateKey);
      if (!definition) return;
      const template = await this.prisma.commerceMessageTemplate.upsert({
        where: { key: templateKey },
        update: {},
        create: {
          key: definition.key,
          eventType: definition.eventType,
          subjectTemplate: definition.subjectTemplate,
          bodyTemplate: definition.bodyTemplate,
        },
      });
      if (!template.enabled) return;
      const payload = this.templatePayload(input.payload);
      await this.prisma.commerceMessage.upsert({
        where: {
          deduplicationKey: buildMessageDeduplicationKey(
            input.eventType,
            input.referenceType,
            input.referenceId,
            input.occurrenceKey,
          ),
        },
        update: {},
        create: {
          deduplicationKey: buildMessageDeduplicationKey(
            input.eventType,
            input.referenceType,
            input.referenceId,
            input.occurrenceKey,
          ),
          eventType: input.eventType,
          templateKey,
          templateVersion: template.version,
          renderedSubject: template.subjectTemplate
            ? renderMessageTemplate(template.subjectTemplate, payload)
            : null,
          renderedBody: renderMessageTemplate(template.bodyTemplate, payload),
          recipient: input.recipient,
          referenceType: input.referenceType,
          referenceId: input.referenceId,
          payload: input.payload,
        },
      });
    } catch (error) {
      this.logger.error('transactional_message_enqueue_failed', error, {
        eventType: input.eventType,
        referenceType: input.referenceType,
        referenceId: input.referenceId,
      });
    }
  }

  async getTemplates() {
    const templates = await this.prisma.$transaction(
      commerceTemplateDefinitions.map((definition) =>
        this.prisma.commerceMessageTemplate.upsert({
          where: { key: definition.key },
          update: {},
          create: {
            key: definition.key,
            eventType: definition.eventType,
            subjectTemplate: definition.subjectTemplate,
            bodyTemplate: definition.bodyTemplate,
          },
        }),
      ),
    );
    return templates.map((template) => ({
      ...template,
      allowedVariables:
        definitionForTemplateKey(template.key)?.allowedVariables ?? [],
    }));
  }

  async updateTemplate(
    key: string,
    dto: UpdateMessageTemplateDto,
    actor: UserPayload,
  ) {
    const normalizedKey = key.normalize('NFKC').trim();
    const definition = definitionForTemplateKey(normalizedKey);
    if (!definition) throw new NotFoundException('Message template not found');
    if (
      dto.enabled === undefined &&
      dto.subjectTemplate === undefined &&
      dto.bodyTemplate === undefined
    ) {
      throw new BadRequestException('Provide at least one template change');
    }
    const current = await this.prisma.commerceMessageTemplate.upsert({
      where: { key: definition.key },
      update: {},
      create: {
        key: definition.key,
        eventType: definition.eventType,
        subjectTemplate: definition.subjectTemplate,
        bodyTemplate: definition.bodyTemplate,
      },
    });
    const subjectTemplate =
      dto.subjectTemplate === undefined
        ? current.subjectTemplate
        : dto.subjectTemplate.normalize('NFKC').trim() || null;
    const bodyTemplate =
      dto.bodyTemplate === undefined
        ? current.bodyTemplate
        : dto.bodyTemplate.normalize('NFKC').trim();
    if (!bodyTemplate) {
      throw new BadRequestException('Message body cannot be empty');
    }
    for (const template of [subjectTemplate, bodyTemplate]) {
      if (!template) continue;
      const validationError = validateMessageTemplate(
        template,
        definition.allowedVariables,
      );
      if (validationError) throw new BadRequestException(validationError);
    }

    return this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.commerceMessageTemplate.update({
        where: { key: definition.key },
        data: {
          enabled: dto.enabled ?? current.enabled,
          subjectTemplate,
          bodyTemplate,
          version: { increment: 1 },
          updatedById: actor.userId,
        },
      });
      await this.audit.record(
        {
          action: 'TRANSACTIONAL_MESSAGE_TEMPLATE_UPDATED',
          entityType: 'CommerceMessageTemplate',
          entityId: updated.key,
          actor,
          previousValue: current,
          newValue: updated,
        },
        transaction,
      );
      return { ...updated, allowedVariables: definition.allowedVariables };
    });
  }

  async getMessages(query: TransactionalMessageQueryDto) {
    const search = query.search?.normalize('NFKC').trim();
    const where: Prisma.CommerceMessageWhereInput = {
      status: query.status,
      eventType: query.eventType
        ? {
            equals: query.eventType.normalize('NFKC').trim(),
            mode: 'insensitive',
          }
        : undefined,
      OR: search
        ? [
            { referenceId: { contains: search, mode: 'insensitive' } },
            { eventType: { contains: search, mode: 'insensitive' } },
            { templateKey: { contains: search, mode: 'insensitive' } },
          ]
        : undefined,
    };
    const [messages, total, grouped] = await this.prisma.$transaction([
      this.prisma.commerceMessage.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
        include: { attempts: { orderBy: { attemptNumber: 'asc' } } },
      }),
      this.prisma.commerceMessage.count({ where }),
      this.prisma.commerceMessage.groupBy({
        by: ['status'],
        orderBy: { status: 'asc' },
        _count: { status: true },
      }),
    ]);
    const policy = await this.getPolicy();
    return {
      items: messages.map((message) => ({
        ...message,
        recipient: maskMessageRecipient(message.recipient),
      })),
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
      counts: Object.fromEntries(
        grouped.map((entry) => [
          entry.status,
          entry._count && typeof entry._count === 'object'
            ? (entry._count.status ?? 0)
            : 0,
        ]),
      ),
      dispatchConfigured: policy.enabled && policy.activationAllowed,
      dispatchNote:
        'Dispatch remains disabled until policy and an approved provider adapter are active',
      policy,
    };
  }

  async getPolicy() {
    const policy = await this.prisma.commerceMessagingPolicy.upsert({
      where: { id: 'transactional-default' },
      update: {},
      create: { id: 'transactional-default' },
    });
    const channels = this.adapters.readiness();
    return {
      ...policy,
      channels,
      activationAllowed: channels.some((channel) => channel.configured),
    };
  }

  async updatePolicy(dto: UpdateMessagingPolicyDto, actor: UserPayload) {
    const current = await this.getPolicy();
    const priority = dto.channelPriority ?? current.channelPriority;
    const enabled = dto.enabled ?? current.enabled;
    if (enabled && priority.length === 0) {
      throw new ConflictException(
        'Choose at least one transactional channel before activation',
      );
    }
    if (
      enabled &&
      !priority.some((channel) => this.adapters.isConfigured(channel))
    ) {
      throw new ConflictException(
        'Configure an approved provider adapter before activating transactional dispatch',
      );
    }

    return this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.commerceMessagingPolicy.update({
        where: { id: 'transactional-default' },
        data: {
          enabled,
          channelPriority: priority as CommerceMessageChannel[],
          fallbackOnDefinitiveFailure:
            dto.fallbackOnDefinitiveFailure ??
            current.fallbackOnDefinitiveFailure,
          version: { increment: 1 },
          updatedById: actor.userId,
        },
      });
      await this.audit.record(
        {
          action: 'TRANSACTIONAL_MESSAGING_POLICY_UPDATED',
          entityType: 'CommerceMessagingPolicy',
          entityId: updated.id,
          actor,
          previousValue: current,
          newValue: updated,
        },
        transaction,
      );
      return { ...updated, channels: this.adapters.readiness() };
    });
  }

  eligibleMessages(limit: number) {
    return this.prisma.commerceMessage.findMany({
      where: {
        status: 'QUEUED',
        availableAt: { lte: new Date() },
        lockedAt: null,
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
      select: { id: true },
    });
  }

  async prepareRetry(messageId: string) {
    const message = await this.prisma.commerceMessage.findUniqueOrThrow({
      where: { id: messageId },
    });
    if (!['FAILED', 'BLOCKED'].includes(message.status)) {
      throw new ConflictException(
        'Only failed or blocked messages can be retried',
      );
    }
    return this.prisma.commerceMessage.update({
      where: { id: messageId },
      data: {
        status: 'QUEUED',
        lockedAt: null,
        completedAt: null,
        failedAt: null,
        terminalReason: null,
        lastError: null,
        channelPlan: [],
        routingPolicyVersion: null,
        fallbackReason: null,
      },
    });
  }

  private templatePayload(value?: Prisma.InputJsonValue) {
    if (!value || Array.isArray(value) || typeof value !== 'object') return {};
    return value as Record<string, unknown>;
  }
}
