import { Injectable, NotFoundException } from '@nestjs/common';
import { TenantDatabaseManager } from '../../infrastructure/tenant/tenant-database.manager';
import { EntitlementService } from '../../infrastructure/entitlements/entitlement.service';
import {
  UtilityScope,
  UtilityResponsibility,
  AllocationMethod,
} from '@prisma/tenant-client';

export interface CreateUtilityAccountInput {
  unitId?: string;
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

    const db = await this.tenantDbManager.getTenantDatabase(organizationId);

    return db.utilityAccount.create({
      data: {
        unitId: input.unitId,
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
        readingDate: new Date(input.readingDate),
        readerName: input.readerName,
        photoUrl: input.photoUrl,
        notes: input.notes,
      },
    });
  }

  async generateUtilityBill(
    organizationId: string,
    input: GenerateUtilityBillInput,
  ) {
    const db = await this.tenantDbManager.getTenantDatabase(organizationId);

    return db.utilityBill.create({
      data: {
        utilityAccountId: input.utilityAccountId,
        periodStart: new Date(input.periodStart),
        periodEnd: new Date(input.periodEnd),
        totalAmount: input.totalAmount,
        allocationMethod: input.allocationMethod || AllocationMethod.EQUAL,
      },
    });
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
