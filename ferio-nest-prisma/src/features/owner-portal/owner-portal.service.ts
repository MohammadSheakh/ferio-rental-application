import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  InvoiceStatus,
  LeaseStatus,
} from '@prisma/tenant-client';
import { ControlPlanePrismaService } from '../../infrastructure/control-plane/control-plane-prisma.service';
import { TenantDatabaseManager } from '../../infrastructure/tenant/tenant-database.manager';

const OPEN_INVOICE_STATUSES = [
  InvoiceStatus.ISSUED,
  InvoiceStatus.PARTIALLY_PAID,
  InvoiceStatus.OVERDUE,
];

interface OwnedUnitContext {
  organization: { id: string; slug: string; name: string };
  db: Awaited<ReturnType<TenantDatabaseManager['getTenantDatabase']>>;
  unitId: string;
  unitName: string;
  propertyName: string | null;
  mySharePercent: number;
  coOwners: Array<{ ownerName: string; sharePercent: number }>;
  lease: {
    id: string;
    status: string;
    monthlyRent: number;
    startDate: Date;
    endDate: Date;
    renterName: string | null;
  } | null;
}

/**
 * Unit Owner Portal Service (§ Week 29)
 *
 * Owners are NOT workspace members — they are unit stakeholders bound
 * via `UnitOwnership.ownerCentralUserId`. Resolution fans out across
 * ACTIVE tenant databases collecting every owned unit stake.
 */
@Injectable()
export class OwnerPortalService {
  constructor(
    private readonly controlPlane: ControlPlanePrismaService,
    private readonly tenantDbManager: TenantDatabaseManager,
  ) {}

  /** All ACTIVE ownership stakes for this identity, across orgs. */
  private async locateAll(centralUserId: string): Promise<OwnedUnitContext[]> {
    const orgs = await this.controlPlane.saasOrganization.findMany({
      where: { status: 'ACTIVE', database: { status: 'READY' } },
      select: { id: true, slug: true, name: true },
    });

    const contexts: OwnedUnitContext[] = [];

    for (const org of orgs) {
      try {
        const db = await this.tenantDbManager.getTenantDatabase(org.id);
        const stakes = await db.unitOwnership.findMany({
          where: { ownerCentralUserId: centralUserId, effectiveTo: null },
          include: {
            unit: {
              include: {
                property: { select: { name: true } },
                leases: {
                  where: { status: { in: [LeaseStatus.ACTIVE, LeaseStatus.NOTICE_GIVEN] } },
                  include: { renter: { select: { name: true } } },
                },
                ownership: { where: { effectiveTo: null } },
              },
            },
          },
        });

        for (const stake of stakes) {
          const activeLease = stake.unit.leases[0] ?? null;
          contexts.push({
            organization: { id: org.id, slug: org.slug, name: org.name },
            db,
            unitId: stake.unitId ?? stake.unit.id,
            unitName: stake.unit.name,
            propertyName: stake.unit.property?.name ?? null,
            mySharePercent: stake.sharePercent,
            coOwners: stake.unit.ownership
              .filter((o) => o.ownerCentralUserId !== centralUserId)
              .map((o) => ({ ownerName: o.ownerName, sharePercent: o.sharePercent })),
            lease: activeLease
              ? {
                  id: activeLease.id,
                  status: activeLease.status,
                  monthlyRent: activeLease.monthlyRent,
                  startDate: activeLease.startDate,
                  endDate: activeLease.endDate,
                  renterName: activeLease.renter?.name ?? null,
                }
              : null,
          });
        }
      } catch {
        // unreachable tenant DB — continue fan-out
      }
    }
    return contexts;
  }

  /** Portfolio snapshot across every org where the identity owns a stake. */
  async me(centralUserId: string) {
    const ctxs = await this.locateAll(centralUserId);
    if (ctxs.length === 0) {
      throw new NotFoundException('No unit ownership found for this account');
    }

    const units = [];
    let totalOutstanding = 0;
    let totalExpectedMonthly = 0;

    for (const c of ctxs) {
      const agg = await c.db.invoice.aggregate({
        where: {
          billingAccount: { unitId: c.unitId },
          status: { in: OPEN_INVOICE_STATUSES },
        },
        _sum: { totalAmount: true, paidAmount: true },
      });
      const outstanding =
        Math.round(
          ((agg._sum.totalAmount ?? 0) - (agg._sum.paidAmount ?? 0)) * 100,
        ) / 100;
      const expected =
        c.lease
          ? Math.round(((c.lease.monthlyRent * c.mySharePercent) / 100) * 100) / 100
          : 0;

      totalOutstanding += outstanding;
      totalExpectedMonthly += expected;

      units.push({
        organization: c.organization,
        unitId: c.unitId,
        unitName: c.unitName,
        propertyName: c.propertyName,
        mySharePercent: c.mySharePercent,
        coOwners: c.coOwners,
        lease: c.lease,
        expectedMonthlyRentBdt: expected,
        outstandingBdt: outstanding,
      });
    }

    return {
      units,
      totals: {
        expectedMonthlyRentBdt: Math.round(totalExpectedMonthly * 100) / 100,
        outstandingBdt: Math.round(totalOutstanding * 100) / 100,
      },
    };
  }

  /** Consolidated statements across every owned unit. */
  async listInvoices(centralUserId: string) {
    const ctxs = await this.locateAll(centralUserId);
    if (ctxs.length === 0) return [];

    const all = [];
    for (const c of ctxs) {
      const rows = await c.db.invoice.findMany({
        where: { billingAccount: { unitId: c.unitId } },
        include: {
          lines: true,
          payments: {
            select: {
              id: true, status: true, amount: true,
              receiptNumber: true, paidAt: true,
            },
          },
          billingAccount: {
            select: { unit: { select: { name: true, property: { select: { name: true } } } } },
          },
        },
        orderBy: { periodStart: 'desc' },
      });
      all.push(...rows);
    }

    // newest first across orgs
    all.sort(
      (a, b) => new Date(b.periodStart).getTime() - new Date(a.periodStart).getTime(),
    );
    return all.map((inv) => ({
      ...inv,
      unitLabel: inv.billingAccount?.unit
        ? `${inv.billingAccount.unit.property?.name ?? ''} · ${inv.billingAccount.unit.name}`.trim()
        : null,
    }));
  }

  /** Maintenance tickets on any owned unit (visibility only). */
  async listMaintenance(centralUserId: string) {
    const ctxs = await this.locateAll(centralUserId);
    const out = [];
    for (const c of ctxs) {
      const rows = await c.db.maintenanceRequest.findMany({
        where: { unitId: c.unitId },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, unitId: true, title: true, description: true, status: true,
          urgency: true, payer: true, estimatedCost: true, actualCost: true,
          createdAt: true, resolvedAt: true,
        },
      });
      out.push(
        ...rows.map((r2) => ({ ...r2, organization: c.organization.slug, unitName: c.unitName })),
      );
    }
    return out.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }
}
