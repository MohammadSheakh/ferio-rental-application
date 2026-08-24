import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { CronJobsService } from './cron-jobs.service';

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

  constructor(private readonly cronJobs: CronJobsService) {}

  onModuleInit() {
    if (process.env.SCHEDULER_DISABLED === 'true') {
      this.logger.log('⏱️ Scheduler disabled via SCHEDULER_DISABLED');
      return;
    }

    const register = (name: string, everyMs: number, fn: () => Promise<unknown>) => {
      const ms = Math.max(everyMs, 30_000);
      const t = setInterval(() => {
        void fn().catch((err) =>
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
      'maintenance-escalation',
      Number(process.env.ESCALATION_INTERVAL_MS || 43_200_000), // 12h
      () => this.cronJobs.runMaintenanceEscalationScan(3),
    );
  }

  onModuleDestroy() {
    for (const t of this.timers) clearInterval(t);
  }
}
