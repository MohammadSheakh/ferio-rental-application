import { Injectable, Logger } from '@nestjs/common';
import { ControlPlanePrismaService } from '../control-plane/control-plane-prisma.service';
import { TenantDatabaseManager } from '../tenant/tenant-database.manager';
import { MarketplacePrismaService } from '../marketplace/marketplace-prisma.service';
import { AutomationService } from '../../features/automation/automation.service';
import { TenantWebhookService } from '../../features/tenant-operations/tenant-webhook.service';
import { SubscriptionLifecycleService } from '../subscriptions/subscription-lifecycle.service';
import { InvoiceStatus } from '@prisma/tenant-client';
import { ListingStatus } from '@prisma/marketplace-client';

@Injectable()
export class CronJobsService {
  private readonly logger = new Logger(CronJobsService.name);

  constructor(
    private readonly controlPlane: ControlPlanePrismaService,
    private readonly tenantDbManager: TenantDatabaseManager,
    private readonly subscriptions: SubscriptionLifecycleService,
    private readonly marketplacePrisma: MarketplacePrismaService,
    private readonly automation: AutomationService,
    private readonly webhooks: TenantWebhookService,
  ) {}

  /**
   * Scan all active tenant databases and mark overdue invoices.
   */
  async runOverdueInvoiceScan() {
    this.logger.log('⏰ Running automated overdue invoice scan across all active tenants...');

    const activeOrgs = await this.controlPlane.saasOrganization.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, slug: true },
    });

    const now = new Date();
    let totalMarkedOverdue = 0;

    for (const org of activeOrgs) {
      try {
        const db = await this.tenantDbManager.getTenantDatabase(org.id);

        // Collect before marking so automations can reference each invoice.
        const due = await db.invoice.findMany({
          where: {
            dueDate: { lt: now },
            status: { in: [InvoiceStatus.ISSUED, InvoiceStatus.PARTIALLY_PAID] },
          },
          select: { id: true, invoiceNumber: true },
          take: 200,
        });

        const result = await db.invoice.updateMany({
          where: { id: { in: due.map((i2) => i2.id) } },
          data: { status: InvoiceStatus.OVERDUE },
        });
        totalMarkedOverdue += result.count;

        // § Week 33: fan out webhook events per newly-overdue invoice
        for (const inv of due) {
          await this.webhooks
            .emit(org.id, 'invoice.overdue', {
              invoiceId: inv.id,
              invoiceNumber: inv.invoiceNumber,
            })
            .catch(() => {});
        }

        for (const inv of due) {
          await this.automation
            .evaluate(org.id, 'INVOICE_OVERDUE', {
              refId: inv.id,
              vars: { refId: inv.invoiceNumber, invoiceNumber: inv.invoiceNumber },
            })
            .catch((err2: any) =>
              this.logger.warn(`automation INVOICE_OVERDUE failed: ${err2?.message}`),
            );
        }
      } catch (error: any) {
        this.logger.error(`Failed overdue scan for org ${org.slug}: ${error.message}`);
      }
    }

    this.logger.log(`✅ Overdue scan completed. Marked ${totalMarkedOverdue} invoices as OVERDUE.`);
    return { activeOrgsScanned: activeOrgs.length, totalMarkedOverdue };
  }

  /**
   * Scan active tenant databases for leases expiring in the next 30 days.
   */
  async runLeaseExpiryScan() {
    this.logger.log('⏰ Running lease expiry scan (30-day lookahead)...');

    const activeOrgs = await this.controlPlane.saasOrganization.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, slug: true },
    });

    const now = new Date();
    const thirtyDaysAhead = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    let totalExpiringLeases = 0;

    for (const org of activeOrgs) {
      try {
        const db = await this.tenantDbManager.getTenantDatabase(org.id);

        const expiringLeases = await db.lease.findMany({
          where: {
            status: 'ACTIVE',
            endDate: { gte: now, lte: thirtyDaysAhead },
          },
          include: {
            unit: { select: { name: true } },
            renter: { select: { name: true, phone: true } },
          },
        });

        totalExpiringLeases += expiringLeases.length;

        // Fire LEASE_EXPIRING automation per expiring lease
        for (const lease of expiringLeases) {
          await this.automation
            .evaluate(org.id, 'LEASE_EXPIRING', {
              refId: lease.id,
              vars: {
                unitName: lease.unit?.name ?? '',
                renterName: lease.renter?.name ?? '',
                endDate: lease.endDate.toISOString().split('T')[0],
              },
            })
            .catch((e2: any) =>
              this.logger.warn(`automation LEASE_EXPIRING failed: ${e2?.message}`),
            );
        }
      } catch (error: any) {
        this.logger.error(`Failed lease expiry scan for org ${org.slug}: ${error.message}`);
      }
    }

    this.logger.log(`✅ Lease expiry scan completed. Identified ${totalExpiringLeases} expiring leases.`);
    return { activeOrgsScanned: activeOrgs.length, totalExpiringLeases };
  }

  /**
   * Expire public listings whose `expiresAt` has passed (§ Week 22 jobs).
   */
  async runListingExpiryScan() {
    const result = await this.marketplacePrisma.propertyListing.updateMany({
      where: {
        status: { in: [ListingStatus.ACTIVE, ListingStatus.PENDING_REVIEW] },
        expiresAt: { lt: new Date() },
      },
      data: { status: ListingStatus.EXPIRED },
    });
    this.logger.log(`⏰ Listing expiry scan: ${result.count} expired`);
    return { expired: result.count };
  }

  /**
   * §23 Paid promotions: flip ACTIVE promotions past their window to
   * EXPIRED and rebuild each affected listing's ranking fields.
   * (Tier map kept in sync with promotion.service.ts PROMOTION_TIER.)
   */
  async runPromotionExpiryScan() {
    const now = new Date();
    const expired = await this.marketplacePrisma.listingPromotion.findMany({
      where: { status: 'ACTIVE', expiresAt: { lt: now } },
      select: { id: true, listingId: true },
    });
    if (!expired.length) {
      this.logger.log('⏰ Promotion expiry scan: nothing expired');
      return { expired: 0, listingsAffected: 0 };
    }

    const listingIds = [...new Set(expired.map((p) => p.listingId))];
    await this.marketplacePrisma.listingPromotion.updateMany({
      where: { id: { in: expired.map((p) => p.id) } },
      data: { status: 'EXPIRED' },
    });

    const tiers: Record<string, number> = { URGENT: 1, FEATURED: 2, TOP_SEARCH: 3 };
    for (const listingId of listingIds) {
      const active = await this.marketplacePrisma.listingPromotion.findMany({
        where: { listingId, status: 'ACTIVE', expiresAt: { gt: now } },
        select: { type: true, expiresAt: true },
      });
      await this.marketplacePrisma.propertyListing.update({
        where: { id: listingId },
        data: {
          promotionTier: active.reduce(
            (max, p) => Math.max(max, tiers[p.type] ?? 0),
            0,
          ),
          promotionBadges: [...new Set(active.map((p) => p.type))],
          promotedUntil:
            active.reduce<Date | null>(
              (latest, p) =>
                !latest || (p.expiresAt && p.expiresAt > latest) ? p.expiresAt : latest,
              null,
            ) ?? null,
        },
      });
    }
    this.logger.log(
      `⏰ Promotion expiry scan: ${expired.length} expired across ${listingIds.length} listings`,
    );
    return { expired: expired.length, listingsAffected: listingIds.length };
  }

  /**
   * Move ACTIVE subscriptions past their period end into PAST_DUE
   * (starts the §15 grace window). Scheduling registration pending —
   * invoke from a BullMQ repeatable job or external scheduler.
   */
  /**
   * § Week 22 GenerateMonthlyStatements — create the current-period
   * invoice for every billing account that has charge definitions.
   * Idempotent via (billingAccount, periodKey) uniqueness; units without
   * charges are skipped silently.
   */
  async runMonthlyStatementScan() {
    this.logger.log('⏰ Running monthly statement generation across active tenants...');
    const orgs = await this.controlPlane.saasOrganization.findMany({
      where: { status: 'ACTIVE', database: { status: 'READY' } },
      select: { id: true, slug: true },
    });

    const now = new Date();
    const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
    const dueDate = new Date(periodStart.getTime() + 10 * 86_400_000);
    const periodKey = periodStart.toISOString().slice(0, 7);

    let created = 0;
    for (const org of orgs) {
      try {
        const db = await this.tenantDbManager.getTenantDatabase(org.id);
        const accounts = await db.billingAccount.findMany({
          include: { _count: { select: { charges: true } } },
        });
        for (const acct of accounts) {
          if (!acct._count.charges) continue;
          const existing = await db.invoice.findFirst({
            where: {
              billingAccountId: acct.id,
              periodKey,
            },
            select: { id: true },
          });
          if (existing) continue;
          try {
            const charges = await db.chargeDefinition.findMany({
              where: { billingAccountId: acct.id },
            });
            const total = charges.reduce((s, c2) => s + c2.amount, 0);
            await db.invoice.create({
              data: {
                billingAccountId: acct.id,
                invoiceNumber: `INV-${periodKey.replace('-', '')}-${Math.floor(1000 + Math.random() * 9000)}`,
                periodKey,
                status: 'ISSUED',
                periodStart,
                periodEnd,
                dueDate,
                totalAmount: total,
                paidAmount: 0,
                issuedAt: now,
                lines: {
                  create: charges.map((c2) => ({
                    category: c2.category,
                    label: c2.label,
                    amount: c2.amount,
                    beneficiaryName: c2.beneficiaryName,
                    beneficiaryType: c2.beneficiaryType,
                  })),
                },
              },
            });
            created++;
          } catch {
            /* unique race — next cycle retries safely */
          }
        }
      } catch (error: any) {
        this.logger.error(`statement scan failed for ${org.slug}: ${error.message}`);
      }
    }

    this.logger.log(`✅ Statement scan completed. ${created} invoices created.`);
    return { orgsScanned: orgs.length, invoicesCreated: created };
  }


  /**
   * § Week 22 SendRentReminder — webhooks + audit trail for invoices due
   * within `daysAhead`. Idempotent-ish: reminders re-fire per scan, so
   * consumers should dedupe by invoiceId.
   */
  async runRentReminderScan(daysAhead = 3) {
    this.logger.log(`⏰ Rent reminder scan (due within ${daysAhead}d)...`);
    const orgs = await this.controlPlane.saasOrganization.findMany({
      where: { status: 'ACTIVE', database: { status: 'READY' } },
      select: { id: true },
    });
    const now = new Date();
    const until = new Date(now.getTime() + daysAhead * 86_400_000);
    let reminded = 0;

    for (const org of orgs) {
      try {
        const db = await this.tenantDbManager.getTenantDatabase(org.id);
        const due = await db.invoice.findMany({
          where: {
            status: { in: ['ISSUED', 'PARTIALLY_PAID'] },
            dueDate: { gte: now, lte: until },
          },
          select: {
            id: true, invoiceNumber: true, totalAmount: true, paidAmount: true,
            billingAccount: { select: { unit: { select: { name: true } } } },
          },
          take: 500,
        });
        for (const inv of due) {
          await this.webhooks
            .emit(org.id, 'rent.reminder', {
              invoiceId: inv.id,
              invoiceNumber: inv.invoiceNumber,
              unitName: inv.billingAccount?.unit?.name ?? null,
              outstandingBdt: Math.round((inv.totalAmount - inv.paidAmount) * 100) / 100,
              dueSoonDays: daysAhead,
            })
            .catch(() => {});
          reminded++;
        }
      } catch (error: any) {
        this.logger.warn(`rent reminder scan skipped org: ${error.message}`);
      }
    }
    this.logger.log(`✅ Rent reminders queued for ${reminded} invoice(s).`);
    return { invoicesReminded: reminded };
  }

  /**
   * § Week 22 MaintenanceEscalation — tickets untouched past `idleDays`
   * get their urgency bumped one level (LOW→NORMAL→URGENT→EMERGENCY).
   * updatedAt gates re-escalation: each bump refreshes the clock.
   */
  async runMaintenanceEscalationScan(idleDays = 3) {
    this.logger.log(`⏰ Maintenance escalation scan (idle > ${idleDays}d)...`);
    const orgs = await this.controlPlane.saasOrganization.findMany({
      where: { status: 'ACTIVE', database: { status: 'READY' } },
      select: { id: true },
    });
    const cutoff = new Date(Date.now() - idleDays * 86_400_000);
    const LADDER = ['LOW', 'NORMAL', 'URGENT', 'EMERGENCY'];
    let escalated = 0;

    for (const org of orgs) {
      try {
        const db = await this.tenantDbManager.getTenantDatabase(org.id);
        const stale = await db.maintenanceRequest.findMany({
          where: {
            status: { in: ['OPEN', 'TRIAGED', 'ASSIGNED', 'IN_PROGRESS'] },
            urgency: { not: 'EMERGENCY' },
            updatedAt: { lt: cutoff },
          },
          select: { id: true, urgency: true },
          take: 200,
        });
        for (const t of stale) {
          const next = LADDER[Math.min(LADDER.length - 1, LADDER.indexOf(t.urgency) + 1)];
          await db.maintenanceRequest.update({
            where: { id: t.id },
            data: { urgency: next as never },
          });
          await this.webhooks
            .emit(org.id, 'maintenance.escalated', {
              requestId: t.id,
              from: t.urgency,
              to: next,
            })
            .catch(() => {});
          escalated++;
        }
      } catch (error: any) {
        this.logger.warn(`escalation scan skipped org: ${error.message}`);
      }
    }
    this.logger.log(`✅ Escalation scan completed. ${escalated} ticket(s) escalated.`);
    return { escalated };
  }


  /**
   * § P2 retention — trim append-heavy tables. Env-tunable day windows.
   */
  async runRetentionSweep() {
    const searchDays = Number(process.env.RETENTION_SEARCH_DAYS || 90);
    const deliveryDays = Number(process.env.RETENTION_DELIVERY_DAYS || 90);
    const cutoffSearch = new Date(Date.now() - searchDays * 86_400_000);
    const cutoffDelivery = new Date(Date.now() - deliveryDays * 86_400_000);

    const search = await this.marketplacePrisma.searchEvent.deleteMany({
      where: { createdAt: { lt: cutoffSearch } },
    });

    let deliveryDeleted = 0;
    const orgs = await this.controlPlane.saasOrganization.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true },
    });
    for (const org of orgs) {
      try {
        const db = await this.tenantDbManager.getTenantDatabase(org.id);
        const r = await db.webhookDelivery.deleteMany({
          where: {
            status: 'SUCCESS',
            deliveredAt: { lt: cutoffDelivery },
          },
        });
        deliveryDeleted += r.count;
      } catch {
        /* unreachable tenant — skip */
      }
    }

    this.logger.log(
      `🧹 Retention: ${search.count} search events, ${deliveryDeleted} webhook deliveries removed`,
    );
    return { searchEventsDeleted: search.count, deliveriesDeleted: deliveryDeleted };
  }

  async runSubscriptionPastDueScan() {
    this.logger.log('⏰ Running subscription past-due scan...');
    const result = await this.subscriptions.scanForPastDue();
    this.logger.log(
      `✅ Subscription scan: ${result.scanned} checked, ${result.markedPastDue} marked PAST_DUE`,
    );
    return result;
  }
}
