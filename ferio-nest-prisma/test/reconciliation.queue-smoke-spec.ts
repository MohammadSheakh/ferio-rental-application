import type { ConfigService } from '@nestjs/config';
import { Queue, QueueEvents, Worker } from 'bullmq';
import { ReconciliationProcessor } from '../src/features/reconciliation/reconciliation.processor';
import {
  RECONCILIATION_SCAN_JOB,
  RECONCILIATION_SCHEDULER_ID,
  ReconciliationJobData,
  ReconciliationQueue,
} from '../src/features/reconciliation/reconciliation.queue';
import type { ReconciliationService } from '../src/features/reconciliation/reconciliation.service';

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
const queueName = `reconciliation-smoke-${process.pid}`;
const queue = new Queue<ReconciliationJobData>(queueName, {
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
      RECONCILIATION_SCHEDULE_ENABLED: 'true',
      RECONCILIATION_SCHEDULE_EVERY_MINUTES: '60',
      RECONCILIATION_OVERDUE_HOURS: '168',
    };
    return values[key] ?? fallback;
  }),
};
const operations = {
  windowHours: 24,
  completedCount: 4,
  failedCount: 1,
  successRate: 80,
  averageDurationMs: 125,
  lastSuccess: { id: 'run-success' },
  lastFailure: { id: 'run-failure' },
};
const reconciliation = {
  recentRuns: jest.fn().mockResolvedValue([{ id: 'run-success' }]),
  operationsSummary: jest.fn().mockResolvedValue(operations),
  getRetryableRun: jest.fn().mockResolvedValue({
    id: 'run-failure',
    overdueHours: 168,
    attemptCount: 1,
  }),
  runScheduled: jest
    .fn()
    .mockRejectedValueOnce(new Error('intentional smoke retry'))
    .mockResolvedValue({ id: 'run-success', status: 'COMPLETED' }),
  retryRun: jest.fn().mockResolvedValue({
    id: 'run-failure',
    status: 'COMPLETED',
  }),
};
const featureQueue = new ReconciliationQueue(
  queue,
  config as unknown as ConfigService,
  reconciliation as unknown as ReconciliationService,
);
const processor = new ReconciliationProcessor(
  reconciliation as unknown as ReconciliationService,
);
let worker: Worker<ReconciliationJobData> | undefined;

describe('Reconciliation BullMQ runtime smoke', () => {
  beforeAll(async () => {
    await Promise.all([queue.waitUntilReady(), queueEvents.waitUntilReady()]);
    await queue.obliterate({ force: true });
    await featureQueue.onModuleInit();
  });

  afterAll(async () => {
    await queue.removeJobScheduler(RECONCILIATION_SCHEDULER_ID);
    await worker?.close();
    await queueEvents.close();
    await queue.obliterate({ force: true });
    await queue.close();
  });

  it('registers an isolated scheduler with its first job waiting', async () => {
    const health = await featureQueue.health();

    expect(health).toEqual(
      expect.objectContaining({
        available: true,
        scheduleEnabled: true,
        operations,
        scheduler: expect.objectContaining({
          id: RECONCILIATION_SCHEDULER_ID,
          name: RECONCILIATION_SCAN_JOB,
        }),
      }),
    );
    expect(health.counts?.waiting).toBe(1);
  });

  it('processes scheduled work and completes after a real BullMQ retry', async () => {
    const waitingJobs = await queue.getWaiting();
    const scheduledJob = waitingJobs.find(
      (job) => job.name === RECONCILIATION_SCAN_JOB,
    );
    expect(scheduledJob).toBeDefined();
    const completion = scheduledJob!.waitUntilFinished(queueEvents, 10000);

    worker = new Worker<ReconciliationJobData>(
      queueName,
      (job) => processor.process(job),
      { connection, prefix: queuePrefix, concurrency: 1 },
    );
    await worker.waitUntilReady();
    await expect(completion).resolves.toEqual(
      expect.objectContaining({ status: 'COMPLETED' }),
    );
    expect(reconciliation.runScheduled).toHaveBeenCalledTimes(2);
    await expect(
      queue.getJobCounts('completed', 'failed', 'delayed'),
    ).resolves.toEqual({ completed: 1, failed: 0, delayed: 1 });
    const scheduler = await queue.getJobScheduler(RECONCILIATION_SCHEDULER_ID);
    expect(scheduler?.next).toBeGreaterThan(Date.now());
  });

  it('enqueues and processes an operator retry with a deterministic id', async () => {
    const result = await featureQueue.enqueueRetry('run-failure', 'admin-1');
    const job = await queue.getJob(result.jobId);
    expect(job).not.toBeNull();
    const completion = job!.waitUntilFinished(queueEvents, 10000);

    await expect(completion).resolves.toEqual(
      expect.objectContaining({ status: 'COMPLETED' }),
    );
    expect(result.jobId).toBe('reconciliation-retry-run-failure-1');
    expect(reconciliation.retryRun).toHaveBeenCalledWith(
      'run-failure',
      result.jobId,
      'admin-1',
    );
  });
});
