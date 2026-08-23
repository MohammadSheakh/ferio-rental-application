import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { ControlPlanePrismaService } from '../../infrastructure/control-plane/control-plane-prisma.service';
import { TenantDatabaseManager } from '../../infrastructure/tenant/tenant-database.manager';
import { TenantBillingService } from '../tenant-operations/tenant-billing.service';
import { PaymentMethod, InvoiceStatus, LeaseStatus } from '@prisma/tenant-client';

/**
 * Renter Portal Service (§ Week 28)
 *
 * The renter is NOT a member of the workspace — they are a party on a
 * lease. Resolution therefore fans out across ACTIVE tenant databases
 * looking for a Renter row bound to the caller's central identity and
 * holding an ACTIVE lease.
 */
@Injectable()
export class RenterPortalService {
  constructor(
    private readonly controlPlane: ControlPlanePrismaService,
    private readonly tenantDbManager: TenantDatabaseManager,
    private readonly billing: TenantBillingService,
  ) {}

  /** Locate the org whose tenant DB has this identity as an occupant. */
  private async locate(centralUserId: string) {
    const orgs = await this.controlPlane.saasOrganization.findMany({
      where: { status: 'ACTIVE', database: { status: 'READY' } },
      select: { id: true, slug: true, name: true },
    });

    for (const org of orgs) {
      try {
        const db = await this.tenantDbManager.getTenantDatabase(org.id);

        // Lease-first lookup: a renter may have multiple rows historically,
        // so anchor on the ACTIVE lease and traverse its relation.
        const lease = await db.lease.findFirst({
          where: {
            status: { in: [LeaseStatus.ACTIVE, LeaseStatus.NOTICE_GIVEN] },
            renter: { centralUserId },
          },
          include: {
            renter: true,
            unit: {
              include: {
                property: true,
                ownership: { where: { effectiveTo: null } },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        });

        if (lease?.renter) {
          return { org, db, renter: lease.renter, lease };
        }
      } catch {
        // unreachable tenant DB — continue fan-out
      }
    }
    throw new NotFoundException('No active tenancy found for this account');
  }

  /** Dashboard payload: tenancy snapshot + how to pay each beneficiary. */
  async me(centralUserId: string) {
    const { org, db, lease } = await this.locate(centralUserId);

    const outstanding = await db.invoice.aggregate({
      where: {
        billingAccount: { unitId: lease.unitId },
        status: { in: [InvoiceStatus.ISSUED, InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.OVERDUE] },
      },
      _sum: { totalAmount: true, paidAmount: true },
    });

    return {
      organization: { slug: org.slug, name: org.name },
      lease: {
        id: lease.id,
        status: lease.status,
        startDate: lease.startDate,
        endDate: lease.endDate,
        monthlyRent: lease.monthlyRent,
      },
      unit: {
        name: lease.unit.name,
        property: lease.unit.property?.name,
        address: lease.unit.property?.address ?? null,
      },
      beneficiaries: lease.unit.ownership.map((o) => ({
        owner: o.ownerName,
        sharePercent: o.sharePercent,
        method: o.paymentMethod,
        bkashNumber: o.bkashNumber,
        nagadNumber: o.nagadNumber,
        bank: o.bankName ? `${o.bankName} · ${o.bankAccountNumber ?? ''}` : null,
        instructions: o.paymentInstructions,
      })),
      outstandingBdt:
        Math.round(((outstanding._sum.totalAmount ?? 0) - (outstanding._sum.paidAmount ?? 0)) * 100) /
        100,
    };
  }

  // ────────────────────────────────────────────────────────────
  // Utilities & Maintenance (Week 28 remainder)
  // ────────────────────────────────────────────────────────────

  /** Utility accounts + latest meter readings for the rented unit. */
  async listUtilities(centralUserId: string) {
    const { db, lease } = await this.locate(centralUserId);
    return db.utilityAccount.findMany({
      where: { unitId: lease.unitId },
      select: {
        id: true,
        type: true,
        provider: true,
        scope: true,
        responsibility: true,
        accountNumber: true,
        meters: {
          select: {
            id: true,
            meterNumber: true,
            readings: {
              orderBy: { readingDate: 'desc' },
              take: 3,
              select: {
                id: true, readingDate: true, previousReading: true,
                currentReading: true, consumption: true, photoUrl: true,
              },
            },
          },
        },
      },
    });
  }

  /** Maintenance requests opened for the rented unit (newest first). */
  async listMaintenance(centralUserId: string) {
    const { db, lease } = await this.locate(centralUserId);
    return db.maintenanceRequest.findMany({
      where: { unitId: lease.unitId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, title: true, description: true, status: true,
        urgency: true, payer: true, photoUrls: true,
        estimatedCost: true, actualCost: true,
        resolvedAt: true, createdAt: true,
        workOrders: { select: { id: true, assignedTo: true, scheduledDate: true, completedAt: true, status: true } },
      },
    });
  }

  /** Renter opens a UNIT-scoped maintenance ticket on their own tenancy. */
  async createMaintenance(
    centralUserId: string,
    input: { title: string; description?: string; urgency?: 'EMERGENCY'|'URGENT'|'NORMAL'|'LOW'; photoUrls?: string[] },
  ) {
    const { org, db, renter, lease } = await this.locate(centralUserId);

    const request = await db.maintenanceRequest.create({
      data: {
        unitId: lease.unitId,
        scope: 'UNIT',
        urgency: input.urgency ?? 'NORMAL',
        payer: 'BUILDING_MANAGEMENT',
        title: input.title,
        description: input.description,
        photoUrls: input.photoUrls ?? [],
        reportedBy: centralUserId,
        reportedByName: renter.name,
        status: 'OPEN',
      },
    });

    await db.tenantAuditEvent.create({
      data: {
        actorId: centralUserId,
        action: 'maintenance.renter_reported',
        resourceType: 'MaintenanceRequest',
        resourceId: request.id,
        metadata: { organizationId: org.id, unitId: lease.unitId, title: input.title },
      },
    }).catch(() => {});

    return request;
  }

  /** Notices visible to this tenancy: org-wide + unit-targeted. */
  async listNotices(centralUserId: string) {
    const { db, lease } = await this.locate(centralUserId);
    return db.notice.findMany({
      where: { OR: [{ unitId: null }, { unitId: lease.unitId }] },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  /** Documents attached to the tenancy (lease or unit). */
  async listDocuments(centralUserId: string) {
    const { db, lease } = await this.locate(centralUserId);
    return db.tenantDocument.findMany({
      where: {
        OR: [
          { attachedToType: 'LEASE', attachedToId: lease.id },
          { attachedToType: 'UNIT', attachedToId: lease.unitId },
        ],
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, category: true, name: true, fileUrl: true,
        attachedToType: true, createdAt: true,
      },
    });
  }

  /** Monthly statements for the rented unit. */
  async listInvoices(centralUserId: string) {
    const { db, lease } = await this.locate(centralUserId);
    return db.invoice.findMany({
      where: { billingAccount: { unitId: lease.unitId } },
      include: {
        lines: true,
        payments: {
          select: { id: true, status: true, amount: true, receiptNumber: true, paidAt: true },
        },
      },
      orderBy: { periodStart: 'desc' },
    });
  }

  /**
   * Renter reports a payment they made directly to the owner/beneficiary
   * (bKash/Nagad/bank…). Enters the staff verification queue — nothing
   * is marked paid until verified (§ Week 19).
   */
  async reportPayment(
    centralUserId: string,
    input: {
      invoiceId: string;
      method: PaymentMethod;
      amount: number;
      reference?: string;
      proofUrl?: string;
    },
  ) {
    const { org, db, lease } = await this.locate(centralUserId);

    const invoice = await db.invoice.findUnique({
      where: { id: input.invoiceId },
      select: { billingAccountId: true },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');

    const account = await db.billingAccount.findUnique({
      where: { id: invoice.billingAccountId },
      select: { unitId: true },
    });
    if (account?.unitId !== lease.unitId) {
      throw new ForbiddenException('This invoice does not belong to your tenancy');
    }

    return this.billing.recordPayment(org.id, {
      invoiceId: input.invoiceId,
      method: input.method,
      amount: input.amount,
      reference: input.reference,
      proofUrl: input.proofUrl,
    });
  }
}
