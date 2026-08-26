import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { CronJobsService } from './cron-jobs.service';
import { PaymentsService } from '../payments/payments.service';
import { Client } from 'pg';
import { tlsOptionsFromUrl } from '../tenant/tls-options';

/**
 * § Week 22 / assessment 🔴 — in-process scheduler registering the
 * recurring scans that previously required manual ops triggers.
 *
 * Intervals are env-tunable; SCHEDULER_DISABLED=true silences everything
 * (ops triggers under /platform/jobs/* remain available either way).
 *
 * Statement generation is idempotent (one invoice per billing account
 * per periodKey), so a tight-ish cadence is safe.
 */
@Injectable()
export class SchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SchedulerService.name);
  private timers: NodeJS.Timeout[] = [];

  constructor(
    private readonly cronJobs: CronJobsService,
    private readonly payments: PaymentsService,
  ) {}

  /** Hold the session advisory lock on one dedicated pg connection. */
  private async withLock<T>(name: string, fn: () => Promise<T>): Promise<T | 'skipped'> {
    const databaseUrl = process.env.CONTROL_PLANE_DATABASE_URL;
    if (!databaseUrl) throw new Error('CONTROL_PLANE_DATABASE_URL is required for scheduler locking');

    const key = `ferio:sched:${name}`;
    const { connectionString, ssl } = tlsOptionsFromUrl(databaseUrl);
    const client = new Client({ connectionString, ssl });
    await client.connect();
    try {
      const result = await client.query<{ ok: boolean }>(
        'SELECT pg_try_advisory_lock(hashtext($1)) AS ok',
        [key],
      );
      if (result.rows[0]?.ok !== true) return 'skipped';
      return await fn();
    } finally {
      await client
        .query('SELECT pg_advisory_unlock(hashtext($1))', [key])
        .catch((err) => this.logger.error(`scheduler unlock failed for ${name}: ${err.message}`));
      await client.end().catch(() => {});
    }
  }

  onModuleInit() {
    if (process.env.SCHEDULER_DISABLED === 'true') {
      this.logger.log('⏱️ Scheduler disabled via SCHEDULER_DISABLED');
      return;
    }

    const register = (name: string, everyMs: number, fn: () => Promise<unknown>) => {
      const ms = Math.max(everyMs, 30_000);
      const t = setInterval(() => {
        void this.withLock(name, fn).catch((err) =>
          this.logger.warn(`scheduled ${name} failed: ${err?.message ?? err}`),
        );
      }, ms);
      t.unref?.();
      this.timers.push(t);
      this.logger.log(`⏱️ scheduled ${name} every ${Math.round(ms / 60_000)}m`);
    };

    // Billing lifecycle
    register(
      'monthly-statements',
      Number(process.env.STATEMENTS_INTERVAL_MS || 3_600_000), // hourly; idempotent per periodKey
      () => this.cronJobs.runMonthlyStatementScan(),
    );
    register(
      'overdue-invoices',
      Number(process.env.OVERDUE_SCAN_INTERVAL_MS || 900_000), // 15 min
      () => this.cronJobs.runOverdueInvoiceScan(),
    );

    // Lifecycle scans
    register(
      'lease-expiry',
      Number(process.env.LEASE_EXPIRY_INTERVAL_MS || 3_600_000),
      () => this.cronJobs.runLeaseExpiryScan(),
    );
    register(
      'listing-expiry',
      Number(process.env.LISTING_EXPIRY_INTERVAL_MS || 1_800_000),
      () => this.cronJobs.runListingExpiryScan(),
    );
    register(
      'promotion-expiry',
      Number(process.env.PROMOTION_EXPIRY_INTERVAL_MS || 1_800_000),
      () => this.cronJobs.runPromotionExpiryScan(),
    );
    register(
      'subscription-past-due',
      Number(process.env.SUBSCRIPTION_SCAN_INTERVAL_MS || 21_600_000), // 6h
      () => this.cronJobs.runSubscriptionPastDueScan(),
    );
    register(
      'rent-reminders',
      Number(process.env.RENT_REMINDER_INTERVAL_MS || 21_600_000), // 6h
      () => this.cronJobs.runRentReminderScan(3),
    );
    register(
      'retention-sweep',
      Number(process.env.RETENTION_INTERVAL_MS || 86_400_000),
      () => this.cronJobs.runRetentionSweep(),
    );
    register(
      'fulfillment-retry',
      Number(process.env.FULFILLMENT_RETRY_INTERVAL_MS || 900_000),
      () => this.payments.refulfillPending(),
    );
    register(
      'maintenance-escalation',
      Number(process.env.ESCALATION_INTERVAL_MS || 43_200_000), // 12h
      () => this.cronJobs.runMaintenanceEscalationScan(3),
    );
  }

  onModuleDestroy() {
    for (const t of this.timers) clearInterval(t);
  }
}
