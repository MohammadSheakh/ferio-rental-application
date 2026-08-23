import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { TenantDatabaseManager } from '../../infrastructure/tenant/tenant-database.manager';
import { LeaseStatus, UnitStatus } from '@prisma/tenant-client';

export interface CreateRenterInput {
  name: string;
  /** Links the renter to a central identity → enables the Renter Portal. */
  centralUserId?: string;
  phone?: string;
  email?: string;
  nidNumber?: string;
  profession?: string;
  emergencyContact?: string;
}

export interface CreateLeaseInput {
  unitId: string;
  renterId: string;
  startDate: string;
  endDate: string;
  monthlyRent: number;
  securityDeposit?: number;
  advanceMonths?: number;
}

@Injectable()
export class TenantLeaseService {
  constructor(private readonly tenantDbManager: TenantDatabaseManager) {}

  async createRenter(organizationId: string, input: CreateRenterInput) {
    const db = await this.tenantDbManager.getTenantDatabase(organizationId);

    // Dedupe: reuse an existing identity-bound row when present.
    if (input.centralUserId) {
      const existing = await db.renter.findFirst({
        where: { centralUserId: input.centralUserId },
      });
      if (existing) {
        return db.renter.update({
          where: { id: existing.id },
          data: { name: input.name, phone: input.phone ?? existing.phone },
        });
      }
    }

    return db.renter.create({
      data: {
        name: input.name,
        centralUserId: input.centralUserId,
        phone: input.phone,
        email: input.email,
        nidNumber: input.nidNumber,
        profession: input.profession,
        emergencyContact: input.emergencyContact,
      },
    });
  }

  async listRenters(organizationId: string) {
    const db = await this.tenantDbManager.getTenantDatabase(organizationId);

    return db.renter.findMany({
      include: {
        leases: {
          include: {
            unit: {
              select: { name: true, property: { select: { name: true } } },
            },
          },
        },
        guarantors: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createLease(organizationId: string, input: CreateLeaseInput) {
    const db = await this.tenantDbManager.getTenantDatabase(organizationId);

    const [unit, renter] = await Promise.all([
      db.unit.findUnique({ where: { id: input.unitId } }),
      db.renter.findUnique({ where: { id: input.renterId } }),
    ]);

    if (!unit) throw new NotFoundException('Unit not found');
    if (!renter) throw new NotFoundException('Renter not found');

    if (unit.status === UnitStatus.OCCUPIED) {
      throw new BadRequestException(
        'Unit is currently occupied by an active lease',
      );
    }

    return db.$transaction(async (tx) => {
      const lease = await tx.lease.create({
        data: {
          unitId: input.unitId,
          renterId: input.renterId,
          startDate: new Date(input.startDate),
          endDate: new Date(input.endDate),
          monthlyRent: input.monthlyRent,
          securityDeposit: input.securityDeposit || 0,
          advanceMonths: input.advanceMonths || 0,
          status: LeaseStatus.ACTIVE,
        },
      });

      await tx.unit.update({
        where: { id: input.unitId },
        data: { status: UnitStatus.OCCUPIED },
      });

      return lease;
    });
  }

  async listLeases(organizationId: string) {
    const db = await this.tenantDbManager.getTenantDatabase(organizationId);

    return db.lease.findMany({
      include: {
        unit: { select: { name: true, property: { select: { name: true } } } },
        renter: { select: { name: true, phone: true, email: true } },
      },
      orderBy: { startDate: 'desc' },
    });
  }
  // ────────────────────────────────────────────────────────────
  // Guarantors (§ Week 13)
  // ────────────────────────────────────────────────────────────

  async createGuarantor(organizationId: string, renterId: string, input: {
    name: string;
    phone?: string;
    nidNumber?: string;
    address?: string;
    relation?: string;
  }) {
    const db = await this.tenantDbManager.getTenantDatabase(organizationId);
    return db.guarantor.create({
      data: { ...input, renterId },
    });
  }

  async listGuarantors(organizationId: string, renterId: string) {
    const db = await this.tenantDbManager.getTenantDatabase(organizationId);
    return db.guarantor.findMany({
      where: { renterId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ────────────────────────────────────────────────────────────
  // Reservations (§ Week 13)
  // ────────────────────────────────────────────────────────────

  /** Mark a unit as RESERVED (holding it for a prospective renter). */
  async reserveUnit(organizationId: string, unitId: string) {
    const db = await this.tenantDbManager.getTenantDatabase(organizationId);
    const unit = await db.unit.findUnique({ where: { id: unitId } });
    if (!unit) throw new Error('Unit not found');
    if (!['AVAILABLE', 'LISTED'].includes(unit.status)) {
      throw new Error(`Cannot reserve a ${unit.status} unit`);
    }
    return db.unit.update({ where: { id: unitId }, data: { status: 'RESERVED' as any } });
  }

}
