import { Injectable, Logger } from '@nestjs/common';
import { ControlPlanePrismaService } from '../control-plane/control-plane-prisma.service';
import { TenantDatabaseManager } from '../tenant/tenant-database.manager';
import { MarketplacePrismaService } from '../marketplace/marketplace-prisma.service';
import { AutomationService } from '../../features/automation/automation.service';
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
   * Move ACTIVE subscriptions past their period end into PAST_DUE
   * (starts the §15 grace window). Scheduling registration pending —
   * invoke from a BullMQ repeatable job or external scheduler.
   */
  async runSubscriptionPastDueScan() {
    this.logger.log('⏰ Running subscription past-due scan...');
    const result = await this.subscriptions.scanForPastDue();
    this.logger.log(
      `✅ Subscription scan: ${result.scanned} checked, ${result.markedPastDue} marked PAST_DUE`,
    );
    return result;
  }
}
