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
}
