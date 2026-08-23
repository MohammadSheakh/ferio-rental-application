import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { TenantDatabaseManager } from '../../infrastructure/tenant/tenant-database.manager';
import { EntitlementService } from '../../infrastructure/entitlements/entitlement.service';
import { PropertyType, UnitType, UnitStatus } from '@prisma/tenant-client';

export interface CreatePropertyInput {
  name: string;
  type: PropertyType;
  address?: string;
  area?: string;
  district?: string;
}

export interface CreateUnitInput {
  propertyId: string;
  buildingId?: string;
  name: string;
  type: UnitType;
  floor?: number;
  bedrooms?: number;
  bathrooms?: number;
  areaSqFt?: number;
  parking?: number;
}

@Injectable()
export class TenantPropertyService {
  constructor(
    private readonly tenantDbManager: TenantDatabaseManager,
    private readonly entitlements: EntitlementService,
  ) {}

  async createProperty(organizationId: string, input: CreatePropertyInput) {
    const db = await this.tenantDbManager.getTenantDatabase(organizationId);

    // Plan quota enforcement (§2.3 — all limits flow through EntitlementService)
    const currentCount = await db.property.count();
    await this.entitlements.checkQuota(
      organizationId,
      'properties',
      currentCount,
    );

    return db.property.create({
      data: {
        name: input.name,
        type: input.type,
        address: input.address,
        area: input.area,
        district: input.district,
        status: 'ACTIVE',
      },
    });
  }

  async listProperties(organizationId: string) {
    const db = await this.tenantDbManager.getTenantDatabase(organizationId);

    return db.property.findMany({
      include: {
        units: true,
        buildings: true,
        ownership: true,
        _count: { select: { units: true, buildings: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getPropertyById(organizationId: string, propertyId: string) {
    const db = await this.tenantDbManager.getTenantDatabase(organizationId);

    const property = await db.property.findUnique({
      where: { id: propertyId },
      include: {
        units: { include: { leases: { where: { status: 'ACTIVE' } } } },
        ownership: true,
        buildings: true,
      },
    });

    if (!property) {
      throw new NotFoundException('Property not found in tenant database');
    }

    return property;
  }

  async createUnit(organizationId: string, input: CreateUnitInput) {
    const db = await this.tenantDbManager.getTenantDatabase(organizationId);

    const property = await db.property.findUnique({
      where: { id: input.propertyId },
    });

    if (!property) {
      throw new NotFoundException('Property not found');
    }

    // Plan quota enforcement
    const currentCount = await db.unit.count();
    await this.entitlements.checkQuota(organizationId, 'units', currentCount);

    return db.unit.create({
      data: {
        propertyId: input.propertyId,
        buildingId: input.buildingId,
        name: input.name,
        type: input.type,
        floor: input.floor,
        bedrooms: input.bedrooms,
        bathrooms: input.bathrooms,
        areaSqFt: input.areaSqFt,
        parking: input.parking || 0,
        status: UnitStatus.AVAILABLE,
      },
    });
  }

  async listUnits(organizationId: string, propertyId?: string) {
    const db = await this.tenantDbManager.getTenantDatabase(organizationId);

    const where: any = {};
    if (propertyId) where.propertyId = propertyId;

    return db.unit.findMany({
      where,
      include: {
        property: { select: { name: true, type: true } },
        leases: {
          where: { status: 'ACTIVE' },
          include: { renter: { select: { name: true, phone: true } } },
        },
        ownership: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  // ────────────────────────────────────────────────────────────
  // Buildings (Weeks 10–11)
  // ────────────────────────────────────────────────────────────

  async createBuilding(
    organizationId: string,
    input: { propertyId: string; name: string; totalFloors?: number; address?: string },
  ) {
    const db = await this.tenantDbManager.getTenantDatabase(organizationId);

    const property = await db.property.findUnique({ where: { id: input.propertyId } });
    if (!property) throw new NotFoundException('Property not found');

    return db.building.create({
      data: {
        propertyId: input.propertyId,
        name: input.name,
        totalFloors: input.totalFloors,
        address: input.address,
      },
    });
  }

  async listBuildings(organizationId: string, propertyId?: string) {
    const db = await this.tenantDbManager.getTenantDatabase(organizationId);
    return db.building.findMany({
      where: propertyId ? { propertyId } : undefined,
      include: { _count: { select: { units: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  // ────────────────────────────────────────────────────────────
  // Ownership (PRD §7 — one building can have multiple unit owners)
  //
  // Invariant enforced here: active (effectiveTo = null) shares per
  // asset must never exceed 100%. History is preserved by closing the
  // old row's effectiveTo instead of mutating it.
  // ────────────────────────────────────────────────────────────

  private static assertShareFits(existingActiveSum: number, incoming: number) {
    if (incoming <= 0 || incoming > 100) {
      throw new BadRequestException('Share percent must be between 0 and 100');
    }
    if (existingActiveSum + incoming > 100 + 1e-9) {
      throw new BadRequestException(
        `Shares would exceed 100% (existing ${existingActiveSum}% + new ${incoming}%)`,
      );
    }
  }

  async addUnitOwner(
    organizationId: string,
    unitId: string,
    input: {
      ownerName: string;
      ownerCentralUserId?: string;
      ownerPhone?: string;
      ownerEmail?: string;
      sharePercent: number;
      isPrimary?: boolean;
      paymentMethod?: string;
      bkashNumber?: string;
      nagadNumber?: string;
      bankAccountName?: string;
      bankAccountNumber?: string;
      bankName?: string;
      bankBranchName?: string;
      paymentInstructions?: string;
    },
  ) {
    const db = await this.tenantDbManager.getTenantDatabase(organizationId);

    const unit = await db.unit.findUnique({ where: { id: unitId }, select: { id: true } });
    if (!unit) throw new NotFoundException('Unit not found');

    const active = await db.unitOwnership.findMany({
      where: { unitId, effectiveTo: null },
    });
    TenantPropertyService.assertShareFits(
      active.reduce((s, o) => s + o.sharePercent, 0),
      input.sharePercent,
    );

    // First owner becomes primary unless overridden.
    const isPrimary = input.isPrimary ?? active.length === 0;

    const [owner] = await db.$transaction([
      db.unitOwnership.create({
        data: { ...input, unitId, isPrimary } as any,
      }),
      db.tenantAuditEvent.create({
        data: {
          actorId: input.ownerCentralUserId ?? null,
          action: 'ownership.unit_added',
          resourceType: 'UnitOwnership',
          resourceId: unitId,
          metadata: { ownerName: input.ownerName, sharePercent: input.sharePercent },
        },
      }),
    ]);
    return owner;
  }

  /** Close the current row and open a replacement — full audit history. */
  async updateUnitOwnerShare(
    organizationId: string,
    ownershipId: string,
    newSharePercent: number,
  ) {
    const db = await this.tenantDbManager.getTenantDatabase(organizationId);

    return db.$transaction(async (tx) => {
      const current = await tx.unitOwnership.findUnique({ where: { id: ownershipId } });
      if (!current || current.effectiveTo) {
        throw new NotFoundException('Active ownership record not found');
      }

      const othersSum = (
        await tx.unitOwnership.findMany({
          where: { unitId: current.unitId, effectiveTo: null, id: { not: ownershipId } },
        })
      ).reduce((s, o) => s + o.sharePercent, 0);
      TenantPropertyService.assertShareFits(othersSum, newSharePercent);

      const now = new Date();
      const updated = await tx.unitOwnership.update({
        where: { id: ownershipId },
        data: { effectiveTo: now },
      });
      const next = await tx.unitOwnership.create({
        data: {
          unitId: current.unitId,
          ownerName: current.ownerName,
          ownerCentralUserId: current.ownerCentralUserId,
          ownerPhone: current.ownerPhone,
          ownerEmail: current.ownerEmail,
          sharePercent: newSharePercent,
          isPrimary: current.isPrimary,
          paymentMethod: current.paymentMethod,
          bkashNumber: current.bkashNumber,
          nagadNumber: current.nagadNumber,
          bankAccountName: current.bankAccountName,
          bankAccountNumber: current.bankAccountNumber,
          bankName: current.bankName,
          bankBranchName: current.bankBranchName,
          paymentInstructions: current.paymentInstructions,
          effectiveFrom: now,
        },
      });

      await tx.tenantAuditEvent.create({
        data: {
          action: 'ownership.unit_share_changed',
          resourceType: 'UnitOwnership',
          resourceId: current.unitId,
          metadata: {
            ownershipId,
            from: updated.sharePercent,
            to: newSharePercent,
          },
        },
      });

      return next;
    });
  }

  /** Set/replace how rent for this owner's share is paid out. */
  async updateUnitOwnerPaymentDestination(
    organizationId: string,
    ownershipId: string,
    payment: {
      paymentMethod?: string;
      bkashNumber?: string;
      nagadNumber?: string;
      bankAccountName?: string;
      bankAccountNumber?: string;
      bankName?: string;
      bankBranchName?: string;
      paymentInstructions?: string;
    },
  ) {
    const db = await this.tenantDbManager.getTenantDatabase(organizationId);

    const current = await db.unitOwnership.findUnique({ where: { id: ownershipId } });
    if (!current || current.effectiveTo) {
      throw new NotFoundException('Active ownership record not found');
    }
    if (!current.isPrimary && !Object.keys(payment).length) {
      throw new BadRequestException('Empty payment destination');
    }

    return db.unitOwnership.update({
      where: { id: ownershipId },
      data: payment as any,
    });
  }

  /** End an owner's stake (keeps history; cannot end the last remaining owner). */
  async endUnitOwnership(organizationId: string, ownershipId: string) {
    const db = await this.tenantDbManager.getTenantDatabase(organizationId);

    return db.$transaction(async (tx) => {
      const current = await tx.unitOwnership.findUnique({ where: { id: ownershipId } });
      if (!current || current.effectiveTo) {
        throw new NotFoundException('Active ownership record not found');
      }
      const activeCount = await tx.unitOwnership.count({
        where: { unitId: current.unitId, effectiveTo: null },
      });
      if (activeCount <= 1) {
        throw new BadRequestException('A unit must retain at least one owner');
      }

      return tx.unitOwnership.update({
        where: { id: ownershipId },
        data: { effectiveTo: new Date() },
      });
    });
  }

  /** Active owners with computed remaining unallocated share. */
  async getUnitOwnershipSummary(organizationId: string, unitId: string) {
    const db = await this.tenantDbManager.getTenantDatabase(organizationId);

    const [active, history] = await Promise.all([
      db.unitOwnership.findMany({ where: { unitId, effectiveTo: null } }),
      db.unitOwnership.findMany({
        where: { unitId, NOT: { effectiveTo: null } },
        orderBy: { effectiveFrom: 'desc' },
      }),
    ]);

    const allocated = active.reduce((s, o) => s + o.sharePercent, 0);
    return {
      owners: active,
      allocatedPercent: Math.round(allocated * 100) / 100,
      unallocatedPercent: Math.round((100 - allocated) * 100) / 100,
      historyCount: history.length,
    };
  }
}
