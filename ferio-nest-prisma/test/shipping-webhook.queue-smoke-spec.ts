import type { ConfigService } from '@nestjs/config';
import { Queue, QueueEvents, Worker } from 'bullmq';
import type { PrismaService } from '@app/database';
import type { AuditService } from '../src/features/audit/audit.service';
import type { ShippingService } from '../src/features/shipping/shipping.service';
import { ShippingWebhookProcessor } from '../src/features/shipping/shipping-webhook.processor';
import {
  COURIER_CALLBACK_RETRY_JOB,
  COURIER_CALLBACK_SCHEDULER_ID,
  COURIER_CALLBACK_SWEEP_JOB,
  CourierCallbackJobData,
  ShippingWebhookQueue,
} from '../src/features/shipping/shipping-webhook.queue';

const redisPort = Number(process.env.TEST_REDIS_PORT);
const queuePrefix = process.env.TEST_QUEUE_PREFIX;
if (!Number.isInteger(redisPort) || redisPort < 1 || redisPort === 6379) {
  throw new Error('TEST_REDIS_PORT must use an isolated non-default Redis port');
}
if (!queuePrefix?.startsWith('ferio:test:')) {
  throw new Error('TEST_QUEUE_PREFIX must start with ferio:test:');
}

const connection = { host: '127.0.0.1', port: redisPort };
const queueName = `courier-callback-smoke-${process.pid}`;
const queue = new Queue<CourierCallbackJobData>(queueName, {
  connection,
  prefix: queuePrefix,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'fixed', delay: 50 },
    removeOnComplete: false,
    removeOnFail: false,
  },
});
const queueEvents = new QueueEvents(queueName, { connection, prefix: queuePrefix });
const config = {
  get: jest.fn((key: string, fallback: string) => {
    const values: Record<string, string> = {
      COURIER_CALLBACK_RETRY_ENABLED: 'true',
      COURIER_CALLBACK_RETRY_EVERY_MINUTES: '60',
      COURIER_CALLBACK_RETRY_MAX_ATTEMPTS: '6',
    };
    return values[key] ?? fallback;
  }),
};
const prisma = {
  shipmentWebhookLog: {
    count: jest.fn().mockResolvedValue(1),
    findMany: jest.fn().mockResolvedValue([
      { id: 'log-scheduled', attemptCount: 1 },
    ]),
    findUnique: jest.fn().mockResolvedValue({
      id: 'log-manual',
      authValid: true,
      processed: false,
      attemptCount: 0,
    }),
  },
};
const audit = { record: jest.fn().mockResolvedValue({}) };
const shipping = {
  retryWebhookLog: jest
    .fn()
    .mockRejectedValueOnce(new Error('intentional callback retry'))
    .mockResolvedValue({ accepted: true, duplicate: false, applied: true }),
};
const featureQueue = new ShippingWebhookQueue(
  queue,
  config as unknown as ConfigService,
  prisma as unknown as PrismaService,
  audit as unknown as AuditService,
);
const processor = new ShippingWebhookProcessor(
  shipping as unknown as ShippingService,
  featureQueue,
);
let worker: Worker<CourierCallbackJobData> | undefined;

describe('Courier callback BullMQ runtime smoke', () => {
  beforeAll(async () => {
    await Promise.all([queue.waitUntilReady(), queueEvents.waitUntilReady()]);
    await queue.obliterate({ force: true });
    await featureQueue.onModuleInit();
  });

  afterAll(async () => {
    await queue.removeJobScheduler(COURIER_CALLBACK_SCHEDULER_ID);
    await worker?.close();
    await queueEvents.close();
    await queue.obliterate({ force: true });
    await queue.close();
  });

  it('registers an isolated callback sweep scheduler', async () => {
    const health = await featureQueue.health();

    expect(health).toEqual(
      expect.objectContaining({
        available: true,
        scheduleEnabled: true,
        recoverableCount: 1,
        scheduler: expect.objectContaining({
          id: COURIER_CALLBACK_SCHEDULER_ID,
          name: COURIER_CALLBACK_SWEEP_JOB,
        }),
      }),
    );
    expect(health.counts?.waiting).toBe(1);
  });

  it('sweeps one callback and completes after a real BullMQ retry', async () => {
    const scheduledJob = (await queue.getWaiting()).find(
      (job) => job.name === COURIER_CALLBACK_SWEEP_JOB,
    );
    expect(scheduledJob).toBeDefined();
    const sweepCompletion = scheduledJob!.waitUntilFinished(queueEvents, 10000);

    worker = new Worker<CourierCallbackJobData>(
      queueName,
      (job) => processor.process(job),
      { connection, prefix: queuePrefix, concurrency: 1 },
    );
    await worker.waitUntilReady();
    await expect(sweepCompletion).resolves.toEqual({ queuedCount: 1 });

    const retryJob = await queue.getJob(
      'courier-callback-retry-log-scheduled-2',
    );
    expect(retryJob?.name).toBe(COURIER_CALLBACK_RETRY_JOB);
    await expect(retryJob!.waitUntilFinished(queueEvents, 10000)).resolves.toEqual(
      expect.objectContaining({ accepted: true, applied: true }),
    );
    expect(shipping.retryWebhookLog).toHaveBeenCalledTimes(2);
  });

  it('queues an audited operator retry with a deterministic ID', async () => {
    const actor = { userId: 'admin-1', role: 'admin' } as const;
    const result = await featureQueue.enqueueRetry('log-manual', actor);
    const job = await queue.getJob(result.jobId);

    expect(result.jobId).toBe('courier-callback-retry-log-manual-1');
    expect(job).not.toBeNull();
    await expect(job!.waitUntilFinished(queueEvents, 10000)).resolves.toEqual(
      expect.objectContaining({ accepted: true }),
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'COURIER_CALLBACK_RETRY_QUEUED',
        entityId: 'log-manual',
      }),
    );
  });
});
