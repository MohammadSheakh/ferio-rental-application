import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { CronJobsService } from './cron-jobs.service';
import { ControlPlanePrismaService } from '../control-plane/control-plane-prisma.service';
import { PaymentsService } from '../payments/payments.service';

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
    private readonly controlPlane: ControlPlanePrismaService,
    private readonly payments: PaymentsService,
  ) {}

  /**
   * § P1 hardening — Postgres advisory lock so N API pods share one
   * scheduler tick. Locks are per-job-name, auto-released on failure,
   * and skipped cleanly when another pod holds the lock.
   */
  private async withLock<T>(name: string, fn: () => Promise<T>): Promise<T | 'skipped'> {
    const key = `ferio:sched:${name}`;
    const got = await this.controlPlane
      .$queryRaw`SELECT pg_try_advisory_lock(hashtext(${key})) AS ok`
      .then((r: any) => r[0]?.ok === true)
      .catch(() => true); // if locking fails, run unlocked (old behaviour)
    if (!got) return 'skipped';
    try {
      return await fn();
    } finally {
      await this.controlPlane
        .$queryRaw`SELECT pg_advisory_unlock(hashtext(${key}))`
        .catch(() => {});
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
