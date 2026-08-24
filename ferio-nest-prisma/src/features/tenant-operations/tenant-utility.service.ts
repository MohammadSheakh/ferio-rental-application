import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { TenantDatabaseManager } from '../../infrastructure/tenant/tenant-database.manager';
import { EntitlementService } from '../../infrastructure/entitlements/entitlement.service';
import {
  UtilityScope,
  UtilityResponsibility,
  AllocationMethod,
  InvoiceStatus,
} from '@prisma/tenant-client';

export interface CreateUtilityAccountInput {
  unitId?: string;
  /** Required for BUILDING/COMMON_AREA scope — anchor for shared-bill allocation. */
  propertyId?: string;
  scope: UtilityScope;
  type: string; // ELECTRICITY | WATER | GAS | INTERNET | GENERATOR
  provider?: string; // DESCO | DPDC | WASA | Titas
  accountNumber?: string;
  responsibility?: UtilityResponsibility;
}

export interface CreateMeterInput {
  utilityAccountId: string;
  meterNumber?: string;
  location?: string;
}

export interface RecordMeterReadingInput {
  meterId: string;
  previousReading: number;
  currentReading: number;
  readingDate: string;
  readerName?: string;
  photoUrl?: string;
  notes?: string;
}

export interface GenerateUtilityBillInput {
  utilityAccountId: string;
  periodStart: string;
  periodEnd: string;
  totalAmount: number;
  allocationMethod?: AllocationMethod;
  /** PERCENTAGE method: explicit weights per unit (must total ~100). */
  weights?: Array<{ unitId: string; percent: number }>;
  /** MANUAL method: exact lines per unit (must total the bill). */
  manualLines?: Array<{ unitId: string; amountBdt: number }>;
  /** FIXED method: identical charge per target unit (× count must equal the bill). */
  fixedPerUnit?: number;
}

@Injectable()
export class TenantUtilityService {
  constructor(
    private readonly tenantDbManager: TenantDatabaseManager,
    private readonly entitlements: EntitlementService,
  ) {}

  async createUtilityAccount(
    organizationId: string,
    input: CreateUtilityAccountInput,
  ) {
    // Feature gate: utilities require an entitled plan
    await this.entitlements.checkFeature(organizationId, 'hasUtilities');

    if (input.scope !== UtilityScope.UNIT && !input.propertyId) {
      throw new BadRequestException(
        'BUILDING/COMMON_AREA scope accounts need a propertyId anchor for allocation',
      );
    }

    const db = await this.tenantDbManager.getTenantDatabase(organizationId);

    return db.utilityAccount.create({
      data: {
        unitId: input.unitId,
        propertyId: input.propertyId,
        scope: input.scope,
        type: input.type,
        provider: input.provider,
        accountNumber: input.accountNumber,
        responsibility: input.responsibility || UtilityResponsibility.RENTER,
      },
    });
  }

  async createMeter(organizationId: string, input: CreateMeterInput) {
    const db = await this.tenantDbManager.getTenantDatabase(organizationId);

    return db.meter.create({
      data: {
        utilityAccountId: input.utilityAccountId,
        meterNumber: input.meterNumber,
        location: input.location,
      },
    });
  }

  async recordMeterReading(
    organizationId: string,
    input: RecordMeterReadingInput,
  ) {
    const db = await this.tenantDbManager.getTenantDatabase(organizationId);

    if (input.currentReading < input.previousReading) {
      throw new BadRequestException(
        'currentReading cannot be less than previousReading',
      );
    }

    // § Weeks 17–18 duplicate prevention: one reading per meter per
    // calendar month — a second entry would double-bill that period.
    const readingDate = new Date(input.readingDate);
    const monthStart = new Date(
      Date.UTC(readingDate.getUTCFullYear(), readingDate.getUTCMonth(), 1),
    );
    const monthEnd = new Date(monthStart.getTime() + 31 * 86_400_000);
    const duplicate = await db.meterReading.findFirst({
      where: {
        meterId: input.meterId,
        readingDate: { gte: monthStart, lt: monthEnd },
      },
      select: { id: true, readingDate: true },
    });
    if (duplicate) {
      throw new BadRequestException(
        `A reading for this meter already exists for ${input.readingDate.slice(0, 7)} (${duplicate.id})`,
      );
    }

    const consumption = Math.max(
      0,
      input.currentReading - input.previousReading,
    );

    return db.meterReading.create({
      data: {
        meterId: input.meterId,
        previousReading: input.previousReading,
        currentReading: input.currentReading,
        consumption,
        readingDate,
        readerName: input.readerName,
        photoUrl: input.photoUrl,
        notes: input.notes,
      },
    });
  }

  /**
   * Generate a utility bill AND compute per-unit allocations (§ Weeks
   * 17–18). The allocation engine supports EQUAL / AREA / OCCUPANCY /
   * SUBMETER / PERCENTAGE / MANUAL with largest-remainder rounding so
   * Σ shares always equals totalAmount exactly (no paisa drift).
   */
  async generateUtilityBill(
    organizationId: string,
    input: GenerateUtilityBillInput,
  ) {
    await this.entitlements.checkFeature(organizationId, 'hasUtilities');

    const db = await this.tenantDbManager.getTenantDatabase(organizationId);

    const account = await db.utilityAccount.findUnique({
      where: { id: input.utilityAccountId },
    });
    if (!account) throw new NotFoundException('Utility account not found');

    if (!(input.totalAmount > 0)) {
      throw new BadRequestException('totalAmount must be positive');
    }
    const method = input.allocationMethod || AllocationMethod.EQUAL;

    // ── Resolve target units ──
    let units: Array<{ id: string; areaSqFt: number | null }> = [];
    if (account.scope === UtilityScope.UNIT && account.unitId) {
      units = await db.unit.findMany({
        where: { id: account.unitId },
        select: { id: true, areaSqFt: true },
      });
    } else if (account.propertyId) {
      units = await db.unit.findMany({
        where: { propertyId: account.propertyId },
        select: { id: true, areaSqFt: true },
      });
    }
    if (!units.length) {
      throw new BadRequestException(
        'No units found to allocate across — set the account propertyId or unitId',
      );
    }

    // ── Compute raw weights per method ──
    const periodStart = new Date(input.periodStart);
    const periodEnd = new Date(input.periodEnd);
    const weights = new Map<string, number>();
    const bases = new Map<string, string>();

    switch (method) {
      case AllocationMethod.EQUAL:
        for (const u of units) weights.set(u.id, 1);
        break;

      case AllocationMethod.AREA:
        for (const u of units) {
          const w = u.areaSqFt ?? 0;
          weights.set(u.id, w);
          if (w > 0) bases.set(u.id, `area=${w} sqft`);
        }
        break;

      case AllocationMethod.OCCUPANCY: {
        const occupied = new Set<string>();
        const activeLeases = await db.lease.findMany({
          where: {
            status: { in: ['ACTIVE', 'NOTICE_GIVEN'] },
            unitId: { in: units.map((u) => u.id) },
          },
          select: { unitId: true },
        });
        for (const l of activeLeases) occupied.add(l.unitId);
        for (const u of units) {
          weights.set(u.id, occupied.has(u.id) ? 1 : 0);
          bases.set(u.id, occupied.has(u.id) ? 'occupied' : 'vacant');
        }
        break;
      }

      case AllocationMethod.SUBMETER: {
        // Weight = Σ consumption recorded in the bill window on meters of
        // UNIT-scope accounts of the same utility type under the property.
        const subAccounts = await db.utilityAccount.findMany({
          where: {
            scope: UtilityScope.UNIT,
            type: account.type,
            unit: account.propertyId
              ? { propertyId: account.propertyId }
              : undefined,
          },
          select: { id: true, unitId: true },
        });
        const readings = await db.meterReading.findMany({
          where: {
            readingDate: { gte: periodStart, lte: periodEnd },
            meter: { utilityAccountId: { in: subAccounts.map((a) => a.id) } },
          },
          select: { consumption: true, meter: { select: { utilityAccountId: true } } },
        });
        const accountToUnit = new Map(subAccounts.map((a) => [a.id, a.unitId as string]));
        for (const r of readings) {
          const unitId = accountToUnit.get(r.meter.utilityAccountId);
          if (!unitId) continue;
          weights.set(unitId, (weights.get(unitId) ?? 0) + r.consumption);
        }
        for (const [unitId, kwh] of weights) bases.set(unitId, `submeter=${kwh} kWh`);
        break;
      }

      case AllocationMethod.FIXED: {
        const perUnit = input.fixedPerUnit;
        if (!(perUnit && perUnit > 0)) {
          throw new BadRequestException('FIXED allocation requires fixedPerUnit');
        }
        const expected = Math.round(perUnit * units.length * 100) / 100;
        if (Math.abs(expected - input.totalAmount) > 0.01) {
          throw new BadRequestException(
            `fixedPerUnit × ${units.length} units = ${expected} ≠ bill amount ${input.totalAmount}`,
          );
        }
        return this.createBillWithAllocations(db, account.id, {
          periodStart,
          periodEnd,
          totalAmount: input.totalAmount,
          method,
          lines: units.map((u) => ({
            unitId: u.id,
            amountBdt: perUnit,
            basis: 'fixed',
          })),
        });
      }

      case AllocationMethod.PERCENTAGE: {
        if (!input.weights?.length) {
          throw new BadRequestException('PERCENTAGE allocation requires weights[]');
        }
        const pctSum = input.weights.reduce((s, w) => s + w.percent, 0);
        if (Math.abs(pctSum - 100) > 0.01) {
          throw new BadRequestException(`weights must total 100% (got ${pctSum})`);
        }
        const known = new Set(units.map((u) => u.id));
        for (const w of input.weights) {
          if (!known.has(w.unitId)) {
            throw new BadRequestException(`weight references unknown unit ${w.unitId}`);
          }
          weights.set(w.unitId, w.percent);
          bases.set(w.unitId, `${w.percent}%`);
        }
        break;
      }

      case AllocationMethod.MANUAL: {
        if (!input.manualLines?.length) {
          throw new BadRequestException('MANUAL allocation requires manualLines[]');
        }
        const lineSum =
          Math.round(input.manualLines.reduce((s, l) => s + l.amountBdt, 0) * 100) / 100;
        if (Math.abs(lineSum - input.totalAmount) > 0.01) {
          throw new BadRequestException(
            `manualLines total ${lineSum} ≠ bill amount ${input.totalAmount}`,
          );
        }
        return this.createBillWithAllocations(db, account.id, {
          periodStart,
          periodEnd,
          totalAmount: input.totalAmount,
          method,
          lines: input.manualLines.map((l) => ({
            unitId: l.unitId,
            amountBdt: l.amountBdt,
            basis: 'manual',
          })),
        });
      }

      default:
        throw new BadRequestException(`Unsupported allocation method ${method}`);
    }

    const totalWeight = [...weights.values()].reduce((s, w) => s + w, 0);
    if (totalWeight <= 0) {
      throw new BadRequestException(
        `All allocation weights are zero (${method}) — nothing to allocate`,
      );
    }

    // ── Largest-remainder rounding in paisa (Σ == totalAmount exactly) ──
    const totalPaisa = Math.round(input.totalAmount * 100);
    const raw = [...weights.entries()].map(([unitId, w]) => ({
      unitId,
      exactPaisa: (w / totalWeight) * totalPaisa,
    }));
    const floors = raw.map((r) => ({ unitId: r.unitId, paisa: Math.floor(r.exactPaisa) }));
    let remainder = totalPaisa - floors.reduce((s, f) => s + f.paisa, 0);
    const byRemainder = raw
      .map((r) => ({
        unitId: r.unitId,
        frac: r.exactPaisa - Math.floor(r.exactPaisa),
      }))
      .sort((a, b) => b.frac - a.frac);
    let idx = 0;
    while (remainder > 0 && byRemainder.length) {
      floors.find((f) => f.unitId === byRemainder[idx % byRemainder.length].unitId)!.paisa += 1;
      remainder -= 1;
      idx += 1;
    }

    const lines = floors.map((f) => ({
      unitId: f.unitId,
      amountBdt: f.paisa / 100,
      basis: bases.get(f.unitId),
    }));

    return this.createBillWithAllocations(db, account.id, {
      periodStart,
      periodEnd,
      totalAmount: input.totalAmount,
      method,
      lines,
    });
  }

  private async createBillWithAllocations(
    db: Awaited<ReturnType<TenantDatabaseManager['getTenantDatabase']>>,
    utilityAccountId: string,
    args: {
      periodStart: Date;
      periodEnd: Date;
      totalAmount: number;
      method: AllocationMethod;
      lines: Array<{ unitId: string; amountBdt: number; basis?: string }>;
    },
  ) {
    return db.utilityBill.create({
      data: {
        utilityAccountId,
        periodStart: args.periodStart,
        periodEnd: args.periodEnd,
        totalAmount: args.totalAmount,
        allocationMethod: args.method,
        allocations: {
          create: args.lines.map((l) => ({
            unitId: l.unitId,
            amountBdt: l.amountBdt,
            basis: l.basis ?? null,
          })),
        },
      },
      include: {
        allocations: { orderBy: { amountBdt: 'desc' } },
        utilityAccount: { select: { type: true, provider: true, scope: true } },
      },
    });
  }

  /**
   * Post each unit's allocated share onto its OPEN invoice for the bill's
   * calendar month as an itemized line (§12 consolidated statement).
   * Idempotent: an identical (label+amount) line is skipped.
   * Units without an open invoice are reported back as skipped.
   */
  async postBillToInvoices(organizationId: string, billId: string) {
    const db = await this.tenantDbManager.getTenantDatabase(organizationId);

    const bill = await db.utilityBill.findUnique({
      where: { id: billId },
      include: {
        allocations: true,
        utilityAccount: { select: { type: true, provider: true } },
      },
    });
    if (!bill) throw new NotFoundException('Utility bill not found');

    const periodKey = bill.periodStart.toISOString().slice(0, 7);
    const category = (
      ['ELECTRICITY', 'WATER', 'GAS', 'INTERNET'].includes(bill.utilityAccount.type)
        ? bill.utilityAccount.type
        : 'OTHER'
    ) as never;
    const label = `${bill.utilityAccount.provider ?? bill.utilityAccount.type} ${periodKey}`;

    const posted: Array<{ unitId: string; invoiceId: string; amountBdt: number }> = [];
    const skipped: Array<{ unitId: string; reason: string }> = [];

    for (const alloc of bill.allocations) {
      const billingAccount = await db.billingAccount.findUnique({
        where: { unitId: alloc.unitId },
        include: {
          invoices: {
            where: { periodKey, status: { in: [InvoiceStatus.ISSUED, InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.OVERDUE] } },
            take: 1,
          },
        },
      });

      const invoice = billingAccount?.invoices[0];
      if (!billingAccount || !invoice) {
        skipped.push({ unitId: alloc.unitId, reason: 'NO_OPEN_INVOICE_FOR_PERIOD' });
        continue;
      }

      const dupe = await db.invoiceLine.findFirst({
        where: { invoiceId: invoice.id, label, amount: alloc.amountBdt },
        select: { id: true },
      });
      if (dupe) {
        skipped.push({ unitId: alloc.unitId, reason: 'ALREADY_POSTED' });
        continue;
      }

      await db.invoiceLine.create({
        data: { invoiceId: invoice.id, category, label, amount: alloc.amountBdt },
      });
      await db.invoice.update({
        where: { id: invoice.id },
        data: { totalAmount: { increment: alloc.amountBdt } },
      });
      posted.push({ unitId: alloc.unitId, invoiceId: invoice.id, amountBdt: alloc.amountBdt });
    }

    return { billId, posted, skipped };
  }

  async listUtilityAccounts(organizationId: string, unitId?: string) {
    const db = await this.tenantDbManager.getTenantDatabase(organizationId);

    const where: any = {};
    if (unitId) where.unitId = unitId;

    return db.utilityAccount.findMany({
      where,
      include: {
        unit: { select: { name: true, property: { select: { name: true } } } },
        meters: {
          include: { readings: { take: 5, orderBy: { readingDate: 'desc' } } },
        },
        bills: { take: 5, orderBy: { periodEnd: 'desc' } },
      },
    });
  }
}
