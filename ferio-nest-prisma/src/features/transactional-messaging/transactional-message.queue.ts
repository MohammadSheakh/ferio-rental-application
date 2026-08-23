import { ConflictException, Injectable, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import type { Queue } from 'bullmq';
import type { UserPayload } from '@app/common';
import { QUEUE_NAMES } from '@app/queue';
import { AuditService } from '../audit/audit.service';
import { TransactionalMessagingService } from './transactional-messaging.service';

export const TRANSACTIONAL_MESSAGE_JOB = 'dispatch-transactional-message';
export const TRANSACTIONAL_MESSAGE_SWEEP_JOB = 'sweep-transactional-messages';
export const TRANSACTIONAL_MESSAGE_SCHEDULER_ID = 'ferio-transactional-message-dispatch';

export type TransactionalMessageJobData = { messageId?: string };

@Injectable()
export class TransactionalMessageQueue implements OnModuleInit {
  constructor(
    @InjectQueue(QUEUE_NAMES.TRANSACTIONAL_MESSAGE)
    private readonly queue: Queue<TransactionalMessageJobData>,
    private readonly config: ConfigService,
    private readonly messages: TransactionalMessagingService,
    private readonly audit: AuditService,
  ) {}

  async onModuleInit() {
    if (!this.enabled()) return;
    await this.queue.upsertJobScheduler(
      TRANSACTIONAL_MESSAGE_SCHEDULER_ID,
      { every: this.everyMinutes() * 60_000 },
      { name: TRANSACTIONAL_MESSAGE_SWEEP_JOB, data: {} },
    );
  }

  async health() {
    const policy = await this.messages.getPolicy();
    try {
      const [counts, scheduler, eligible] = await Promise.all([
        this.queue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed'),
        this.queue.getJobScheduler(TRANSACTIONAL_MESSAGE_SCHEDULER_ID),
        this.messages.eligibleMessages(this.batchSize()),
      ]);
      return {
        available: true,
        dispatchEnabled: this.enabled(),
        everyMinutes: this.everyMinutes(),
        batchSize: this.batchSize(),
        eligibleCount: eligible.length,
        counts,
        scheduler: scheduler ? { id: scheduler.id, name: scheduler.name, next: scheduler.next } : null,
        policyEnabled: policy.enabled,
      };
    } catch (error) {
      return {
        available: false,
        dispatchEnabled: this.enabled(),
        everyMinutes: this.everyMinutes(),
        batchSize: this.batchSize(),
        error: error instanceof Error ? error.message : 'Queue unavailable',
        policyEnabled: policy.enabled,
      };
    }
  }

  async enqueueDue() {
    const messages = await this.messages.eligibleMessages(this.batchSize());
    const jobs = await this.queue.addBulk(
      messages.map(({ id }) => ({
        name: TRANSACTIONAL_MESSAGE_JOB,
        data: { messageId: id },
        opts: { jobId: `transactional-message-${id}` },
      })),
    );
    return { queuedCount: jobs.length };
  }

  async retry(messageId: string, actor: UserPayload) {
    if (!this.enabled()) {
      throw new ConflictException('Transactional dispatch is disabled by deployment configuration');
    }
    const policy = await this.messages.getPolicy();
    if (!policy.enabled) throw new ConflictException('Transactional routing policy is disabled');
    await this.messages.prepareRetry(messageId);
    const job = await this.queue.add(
      TRANSACTIONAL_MESSAGE_JOB,
      { messageId },
      { jobId: `transactional-message-${messageId}-${Date.now()}` },
    );
    await this.audit.record({
      action: 'TRANSACTIONAL_MESSAGE_RETRY_QUEUED',
      entityType: 'CommerceMessage',
      entityId: messageId,
      actor,
      newValue: { jobId: String(job.id) },
    });
    return { messageId, jobId: String(job.id), status: 'QUEUED' as const };
  }

  private enabled() {
    return this.config.get<string>('TRANSACTIONAL_MESSAGE_DISPATCH_ENABLED', 'false') === 'true';
  }

  private everyMinutes() {
    return Number(this.config.get<string>('TRANSACTIONAL_MESSAGE_SWEEP_EVERY_MINUTES', '5'));
  }

  private batchSize() {
    return Number(this.config.get<string>('TRANSACTIONAL_MESSAGE_BATCH_SIZE', '100'));
  }
}
