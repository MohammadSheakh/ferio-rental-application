import type { ConfigService } from '@nestjs/config';
import { Queue, QueueEvents, Worker } from 'bullmq';
import type { AuditService } from '../src/features/audit/audit.service';
import type { ShippingPollingService } from '../src/features/shipping/shipping-polling.service';
import { ShippingPollingProcessor } from '../src/features/shipping/shipping-polling.processor';
import {
  COURIER_POLL_JOB,
  COURIER_POLL_SCHEDULER_ID,
  COURIER_POLL_SWEEP_JOB,
  CourierPollJobData,
  ShippingPollingQueue,
} from '../src/features/shipping/shipping-polling.queue';

const redisPort = Number(process.env.TEST_REDIS_PORT);
const queuePrefix = process.env.TEST_QUEUE_PREFIX;
if (!Number.isInteger(redisPort) || redisPort < 1 || redisPort === 6379) {
  throw new Error(
    'TEST_REDIS_PORT must use an isolated non-default Redis port',
  );
}
if (!queuePrefix?.startsWith('ferio:test:')) {
  throw new Error('TEST_QUEUE_PREFIX must start with ferio:test:');
}

const connection = { host: '127.0.0.1', port: redisPort };
const queueName = `courier-poll-smoke-${process.pid}`;
const queue = new Queue<CourierPollJobData>(queueName, {
  connection,
  prefix: queuePrefix,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'fixed', delay: 50 },
    removeOnComplete: false,
    removeOnFail: false,
  },
});
const queueEvents = new QueueEvents(queueName, {
  connection,
  prefix: queuePrefix,
});
const config = {
  get: jest.fn((key: string, fallback: string) => {
    const values: Record<string, string> = {
      COURIER_POLLING_ENABLED: 'true',
      COURIER_POLLING_EVERY_MINUTES: '60',
      COURIER_POLLING_BATCH_SIZE: '10',
    };
    return values[key] ?? fallback;
  }),
};
const polling = {
  eligibleShipments: jest.fn().mockResolvedValue([{ id: 'shipment-1' }]),
  prepareAttempt: jest.fn().mockResolvedValue({ id: 'poll-attempt-1' }),
  attachQueueJob: jest.fn().mockResolvedValue({}),
  execute: jest
    .fn()
    .mockRejectedValueOnce(new Error('intentional polling retry'))
    .mockResolvedValue({ id: 'poll-attempt-1', status: 'SUCCEEDED' }),
};
const audit = { record: jest.fn().mockResolvedValue({}) };
const featureQueue = new ShippingPollingQueue(
  queue,
  config as unknown as ConfigService,
  polling as unknown as ShippingPollingService,
  audit as unknown as AuditService,
);
const processor = new ShippingPollingProcessor(
  polling as unknown as ShippingPollingService,
  featureQueue,
);
let worker: Worker<CourierPollJobData> | undefined;

describe('Courier polling BullMQ runtime smoke', () => {
  beforeAll(async () => {
    await Promise.all([queue.waitUntilReady(), queueEvents.waitUntilReady()]);
    await queue.obliterate({ force: true });
    await featureQueue.onModuleInit();
  });

  afterAll(async () => {
    await queue.removeJobScheduler(COURIER_POLL_SCHEDULER_ID);
    await worker?.close();
    await queueEvents.close();
    await queue.obliterate({ force: true });
    await queue.close();
  });

  it('schedules, discovers, and retries one poll to completion', async () => {
    const health = await featureQueue.health();
    expect(health).toEqual(
      expect.objectContaining({
        available: true,
        scheduleEnabled: true,
        eligibleCount: 1,
        scheduler: expect.objectContaining({
          id: COURIER_POLL_SCHEDULER_ID,
          name: COURIER_POLL_SWEEP_JOB,
        }),
      }),
    );
    const sweepJob = (await queue.getWaiting()).find(
      (job) => job.name === COURIER_POLL_SWEEP_JOB,
    );
    expect(sweepJob).toBeDefined();
    const sweepCompletion = sweepJob!.waitUntilFinished(queueEvents, 10000);
    worker = new Worker<CourierPollJobData>(
      queueName,
      (job) => processor.process(job),
      { connection, prefix: queuePrefix, concurrency: 1 },
    );
    await worker.waitUntilReady();
    await expect(sweepCompletion).resolves.toEqual({ queuedCount: 1 });

    const pollJob = await queue.getJob('courier-poll-poll-attempt-1');
    expect(pollJob?.name).toBe(COURIER_POLL_JOB);
    await expect(
      pollJob!.waitUntilFinished(queueEvents, 10000),
    ).resolves.toEqual(expect.objectContaining({ status: 'SUCCEEDED' }));
    expect(polling.execute).toHaveBeenCalledTimes(2);
  });
});
