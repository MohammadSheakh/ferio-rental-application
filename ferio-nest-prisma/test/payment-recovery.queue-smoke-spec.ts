import type { ConfigService } from '@nestjs/config';
import { Queue, QueueEvents, Worker } from 'bullmq';
import type { AuditService } from '../src/features/audit/audit.service';
import type { CommercePaymentsService } from '../src/features/commerce-payments/commerce-payments.service';
import { PaymentRecoveryProcessor } from '../src/features/commerce-payments/payment-recovery.processor';
import { PAYMENT_EXPIRY_JOB, PAYMENT_EXPIRY_SWEEP_JOB, PAYMENT_RECOVERY_SCHEDULER_ID, PaymentRecoveryJobData, PaymentRecoveryQueue } from '../src/features/commerce-payments/payment-recovery.queue';

const redisPort = Number(process.env.TEST_REDIS_PORT);
const queuePrefix = process.env.TEST_QUEUE_PREFIX;
if (!Number.isInteger(redisPort) || redisPort < 1 || redisPort === 6379) throw new Error('TEST_REDIS_PORT must use an isolated non-default Redis port');
if (!queuePrefix?.startsWith('ferio:test:')) throw new Error('TEST_QUEUE_PREFIX must start with ferio:test:');

const connection = { host: '127.0.0.1', port: redisPort };
const queueName = `payment-recovery-smoke-${process.pid}`;
const queue = new Queue<PaymentRecoveryJobData>(queueName, { connection, prefix: queuePrefix, defaultJobOptions: { attempts: 2, backoff: { type: 'fixed', delay: 50 }, removeOnComplete: false } });
const events = new QueueEvents(queueName, { connection, prefix: queuePrefix });
const config = { get: jest.fn((key: string, fallback: string) => ({ PAYMENT_RECOVERY_ENABLED: 'true', PAYMENT_RECOVERY_EVERY_MINUTES: '60', PAYMENT_RECOVERY_BATCH_SIZE: '10' })[key] ?? fallback) };
const payments = {
  eligibleExpiredAttempts: jest.fn().mockResolvedValue([{ id: 'attempt-1' }]),
  expireAttempt: jest.fn().mockRejectedValueOnce(new Error('intentional expiry retry')).mockResolvedValue({ id: 'attempt-1', status: 'EXPIRED' }),
};
const recovery = new PaymentRecoveryQueue(queue, config as unknown as ConfigService, payments as unknown as CommercePaymentsService, { record: jest.fn() } as unknown as AuditService);
const processor = new PaymentRecoveryProcessor(payments as unknown as CommercePaymentsService, recovery);
let worker: Worker<PaymentRecoveryJobData> | undefined;

describe('Payment recovery BullMQ runtime smoke', () => {
  beforeAll(async () => { await Promise.all([queue.waitUntilReady(), events.waitUntilReady()]); await queue.obliterate({ force: true }); await recovery.onModuleInit(); });
  afterAll(async () => { await queue.removeJobScheduler(PAYMENT_RECOVERY_SCHEDULER_ID); await worker?.close(); await events.close(); await queue.obliterate({ force: true }); await queue.close(); });

  it('schedules due attempts and retries expiry work', async () => {
    const health = await recovery.health();
    expect(health).toEqual(expect.objectContaining({ available: true, enabled: true, eligibleCount: 1 }));
    const sweep = (await queue.getWaiting()).find((job) => job.name === PAYMENT_EXPIRY_SWEEP_JOB);
    expect(sweep).toBeDefined();
    const sweepDone = sweep!.waitUntilFinished(events, 10000);
    worker = new Worker(queueName, (job) => processor.process(job), { connection, prefix: queuePrefix });
    await worker.waitUntilReady();
    await expect(sweepDone).resolves.toEqual({ queuedCount: 1 });
    const expiry = await queue.getJob('payment-expiry-attempt-1');
    expect(expiry?.name).toBe(PAYMENT_EXPIRY_JOB);
    await expect(expiry!.waitUntilFinished(events, 10000)).resolves.toEqual(expect.objectContaining({ status: 'EXPIRED' }));
    expect(payments.expireAttempt).toHaveBeenCalledTimes(2);
  });
});
