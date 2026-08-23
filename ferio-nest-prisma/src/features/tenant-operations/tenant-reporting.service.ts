import { Injectable } from '@nestjs/common';
import { TenantDatabaseManager } from '../../infrastructure/tenant/tenant-database.manager';
import {
  UnitStatus,
  InvoiceStatus,
  MaintenanceStatus,
} from '@prisma/tenant-client';

@Injectable()
export class TenantReportingService {
  constructor(private readonly tenantDbManager: TenantDatabaseManager) {}

  /**
   * Executive Occupancy & Vacancy Analytics Report
   */
  async getOccupancyReport(organizationId: string) {
    const db = await this.tenantDbManager.getTenantDatabase(organizationId);

    const units = await db.unit.findMany({
      select: { id: true, status: true, propertyId: true },
    });

    const totalUnits = units.length;
    const occupiedUnits = units.filter(
      (u) => u.status === UnitStatus.OCCUPIED,
    ).length;
    const availableUnits = units.filter(
      (u) => u.status === UnitStatus.AVAILABLE,
    ).length;
    const reservedUnits = units.filter(
      (u) => u.status === UnitStatus.RESERVED,
    ).length;
    const maintenanceUnits = units.filter(
      (u) => u.status === UnitStatus.MAINTENANCE_HOLD,
    ).length;

    const occupancyRate =
      totalUnits > 0
        ? Number(((occupiedUnits / totalUnits) * 100).toFixed(2))
        : 0;
    const vacancyRate =
      totalUnits > 0
        ? Number(((availableUnits / totalUnits) * 100).toFixed(2))
        : 0;

    return {
      totalUnits,
      occupiedUnits,
      availableUnits,
      reservedUnits,
      maintenanceUnits,
      occupancyRatePercent: occupancyRate,
      vacancyRatePercent: vacancyRate,
    };
  }

  /**
   * Rent Collection & Financial Performance Report
   */
  async getFinancialReport(organizationId: string) {
    const db = await this.tenantDbManager.getTenantDatabase(organizationId);

    const invoices = await db.invoice.findMany({
      select: {
        totalAmount: true,
        paidAmount: true,
        status: true,
        lines: {
          select: { category: true, amount: true, beneficiaryType: true },
        },
      },
    });

    const totalBilled = invoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
    const totalCollected = invoices.reduce(
      (sum, inv) => sum + inv.paidAmount,
      0,
    );
    const totalOutstanding = Math.max(0, totalBilled - totalCollected);

    const collectionRate =
      totalBilled > 0
        ? Number(((totalCollected / totalBilled) * 100).toFixed(2))
        : 0;

    const paidInvoicesCount = invoices.filter(
      (i) => i.status === InvoiceStatus.PAID,
    ).length;
    const overdueInvoicesCount = invoices.filter(
      (i) => i.status === InvoiceStatus.OVERDUE,
    ).length;
    const pendingInvoicesCount = invoices.filter(
      (i) =>
        i.status === InvoiceStatus.ISSUED ||
        i.status === InvoiceStatus.PARTIALLY_PAID,
    ).length;

    return {
      totalBilledBdt: totalBilled,
      totalCollectedBdt: totalCollected,
      totalOutstandingBdt: totalOutstanding,
      collectionRatePercent: collectionRate,
      paidInvoicesCount,
      overdueInvoicesCount,
      pendingInvoicesCount,
    };
  }

  /**
   * Multi-Beneficiary Receivable Split Report (Unit Owner vs Building Management vs Utility Providers)
   */
  async getBeneficiarySplitReport(organizationId: string) {
    const db = await this.tenantDbManager.getTenantDatabase(organizationId);

    const lines = await db.invoiceLine.findMany({
      select: {
        category: true,
        label: true,
        amount: true,
        beneficiaryName: true,
        beneficiaryType: true,
      },
    });

    const unitOwnerTotal = lines
      .filter(
        (l) => l.category === 'RENT' || l.beneficiaryType === 'UNIT_OWNER',
      )
      .reduce((sum, l) => sum + l.amount, 0);

    const managementTotal = lines
      .filter(
        (l) =>
          l.category === 'SERVICE_CHARGE' ||
          l.beneficiaryType === 'BUILDING_MANAGEMENT',
      )
      .reduce((sum, l) => sum + l.amount, 0);

    const utilityTotal = lines
      .filter((l) =>
        ['ELECTRICITY', 'WATER', 'GAS', 'INTERNET', 'GENERATOR'].includes(
          l.category,
        ),
      )
      .reduce((sum, l) => sum + l.amount, 0);

    return {
      unitOwnerReceivableBdt: unitOwnerTotal,
      buildingManagementReceivableBdt: managementTotal,
      utilityProvidersReceivableBdt: utilityTotal,
    };
  }

  /**
   * Maintenance Performance & Expenditure Report
   */
  async getMaintenanceReport(organizationId: string) {
    const db = await this.tenantDbManager.getTenantDatabase(organizationId);

    const requests = await db.maintenanceRequest.findMany({
      include: { workOrders: { select: { cost: true, status: true } } },
    });

    const totalRequests = requests.length;
    const openRequests = requests.filter(
      (r) =>
        r.status === MaintenanceStatus.OPEN ||
        r.status === MaintenanceStatus.ASSIGNED,
    ).length;
    const resolvedRequests = requests.filter(
      (r) =>
        r.status === MaintenanceStatus.RESOLVED ||
        r.status === MaintenanceStatus.CLOSED,
    ).length;

    const totalCost = requests.reduce((sum, req) => {
      const orderCost = req.workOrders.reduce(
        (wSum, wo) => wSum + (wo.cost || 0),
        0,
      );
      return sum + orderCost;
    }, 0);

    return {
      totalRequests,
      openRequests,
      resolvedRequests,
      resolutionRatePercent:
        totalRequests > 0
          ? Number(((resolvedRequests / totalRequests) * 100).toFixed(2))
          : 0,
      totalMaintenanceExpenditureBdt: totalCost,
    };
  }

  /**
   * Overdue renters report — renters with overdue invoices and amounts.
   */
  async getOverdueRentersReport(organizationId: string) {
    const db = await this.tenantDbManager.getTenantDatabase(organizationId);

    const overdueInvoices = await db.invoice.findMany({
      where: { status: InvoiceStatus.OVERDUE },
      include: {
        billingAccount: {
          include: {
            unit: {
              select: {
                name: true,
                property: { select: { name: true } },
                leases: {
                  where: { status: 'ACTIVE' },
                  select: { renter: { select: { name: true, phone: true } } },
                  take: 1,
                },
              },
            },
          },
        },
      },
      orderBy: { dueDate: 'asc' },
    });

    return overdueInvoices.map((inv) => ({
      invoiceNumber: inv.invoiceNumber,
      renterName: inv.billingAccount?.unit?.leases[0]?.renter?.name ?? 'Unknown',
      renterPhone: inv.billingAccount?.unit?.leases[0]?.renter?.phone ?? null,
      unitName: inv.billingAccount?.unit?.name ?? '',
      propertyName: inv.billingAccount?.unit?.property?.name ?? '',
      totalAmount: inv.totalAmount,
      paidAmount: inv.paidAmount,
      outstandingBdt: Math.round((inv.totalAmount - inv.paidAmount) * 100) / 100,
      dueDate: inv.dueDate,
    }));
  }

  /**
   * Lease expiry report — ACTIVE leases ending within the next N days.
   */
  async getLeaseExpiryReport(organizationId: string, daysAhead = 90) {
    const db = await this.tenantDbManager.getTenantDatabase(organizationId);
    const now = new Date();
    const cutoff = new Date(now.getTime() + daysAhead * 86_400_000);

    const expiring = await db.lease.findMany({
      where: { status: 'ACTIVE', endDate: { gte: now, lte: cutoff } },
      include: {
        unit: {
          select: {
            name: true,
            property: { select: { name: true } },
          },
        },
        renter: { select: { name: true, phone: true } },
      },
      orderBy: { endDate: 'asc' },
    });

    return expiring.map((l) => ({
      leaseId: l.id,
      unitName: l.unit.name,
      propertyName: l.unit.property?.name ?? '',
      renterName: l.renter.name,
      renterPhone: l.renter.phone,
      monthlyRent: l.monthlyRent,
      endDate: l.endDate,
      daysRemaining: Math.ceil(
        (new Date(l.endDate).getTime() - now.getTime()) / 86_400_000,
      ),
    }));
  }

  /**
   * Utility & service charge collection breakdown.
   */
  async getUtilityCollectionReport(organizationId: string) {
    const db = await this.tenantDbManager.getTenantDatabase(organizationId);

    const lines = await db.invoiceLine.findMany({
      where: {
        category: {
          in: [
            'ELECTRICITY', 'WATER', 'GAS', 'INTERNET',
            'SECURITY', 'LIFT', 'CLEANING', 'GENERATOR',
          ],
        },
      },
      select: { category: true, amount: true, label: true },
    });

    const serviceChargeLines = await db.invoiceLine.findMany({
      where: { category: 'SERVICE_CHARGE' },
      select: { amount: true },
    });

    const byCategory: Record<string, number> = {};
    for (const l of lines) {
      byCategory[l.category] = (byCategory[l.category] ?? 0) + l.amount;
    }

    return {
      utilityBreakdown: Object.fromEntries(
        Object.entries(byCategory).map(([k, v]) => [k.toLowerCase(), Math.round(v * 100) / 100]),
      ),
      totalUtilityBdt: Math.round(lines.reduce((s, l) => s + l.amount, 0) * 100) / 100,
      totalServiceChargeBdt:
        Math.round(serviceChargeLines.reduce((s, l) => s + l.amount, 0) * 100) / 100,
    };
  }

  /**
   * Unit profitability — revenue collected vs maintenance cost per unit.
   */
  async getUnitProfitabilityReport(organizationId: string) {
    const db = await this.tenantDbManager.getTenantDatabase(organizationId);

    const units = await db.unit.findMany({
      select: {
        id: true,
        name: true,
        property: { select: { name: true } },
        billingAccount: {
          select: {
            invoices: { select: { totalAmount: true, paidAmount: true, status: true } },
          },
        },
        maintenanceRequests: {
          include: { workOrders: { select: { cost: true } } },
        },
        leases: {
          where: { status: 'ACTIVE' },
          select: { monthlyRent: true },
          take: 1,
        },
      },
    });

    return units.map((u) => {
      const billed = u.billingAccount?.invoices?.reduce((s, i) => s + i.totalAmount, 0) ?? 0;
      const collected =
        u.billingAccount?.invoices?.reduce((s, i) => s + i.paidAmount, 0) ?? 0;
      const maintenanceCost = u.maintenanceRequests.reduce(
        (sum, mr) => sum + mr.workOrders.reduce((ws, wo) => ws + (wo.cost ?? 0), 0),
        0,
      );
      const netIncome = Math.round((collected - maintenanceCost) * 100) / 100;

      return {
        unitId: u.id,
        unitName: u.name,
        propertyName: u.property?.name ?? '',
        activeLeaseRent: u.leases[0]?.monthlyRent ?? null,
        totalBilledBdt: billed,
        collectedBdt: collected,
        outstandingBdt: Math.round((billed - collected) * 100) / 100,
        maintenanceCostBdt: maintenanceCost,
        netIncomeBdt: netIncome,
        profitabilityPercent:
          billed > 0 ? Number((((netIncome / billed) * 100)).toFixed(1)) : 0,
      };
    });
  }
}
