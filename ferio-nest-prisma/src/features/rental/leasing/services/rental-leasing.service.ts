import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@app/database';
import { CreateRentalLeaseDto, AddLeasePartyDto } from '../dto/rental-lease.dto';
import { RentalLeaseStatus, RentalUnitStatus, RentalChargeCategory } from '@prisma/client';

@Injectable()
export class RentalLeasingService {
  constructor(private readonly prisma: PrismaService) {}

  async createLease(dto: CreateRentalLeaseDto) {
    const unit = await this.prisma.rentalUnit.findUnique({
      where: { id: dto.unitId },
    });

    if (!unit) {
      throw new NotFoundException(`Unit with ID '${dto.unitId}' not found.`);
    }

    if (unit.status === RentalUnitStatus.OCCUPIED) {
      throw new BadRequestException(`Unit '${unit.unitNumber}' is currently OCCUPIED.`);
    }

    const existingLeaseNumber = await this.prisma.rentalLease.findUnique({
      where: { leaseNumber: dto.leaseNumber },
    });

    if (existingLeaseNumber) {
      throw new ConflictException(`Lease number '${dto.leaseNumber}' already exists.`);
    }

    return this.prisma.$transaction(async (tx) => {
      const lease = await tx.rentalLease.create({
        data: {
          organizationId: dto.organizationId,
          unitId: dto.unitId,
          applicationId: dto.applicationId,
          leaseNumber: dto.leaseNumber,
          startDate: new Date(dto.startDate),
          endDate: new Date(dto.endDate),
          rentAmount: dto.rentAmount,
          serviceCharge: dto.serviceCharge || 0,
          securityDeposit: dto.securityDeposit || 0,
          billingFrequency: dto.billingFrequency,
          dueDay: dto.dueDay,
          gracePeriodDays: dto.gracePeriodDays,
          noticePeriodDays: dto.noticePeriodDays,
          status: RentalLeaseStatus.DRAFT,
        },
      });

      // Attach Primary Tenant
      await tx.rentalLeaseParty.create({
        data: {
          leaseId: lease.id,
          personId: dto.primaryTenantPersonId,
          role: 'PRIMARY_TENANT',
          financiallyResponsible: true,
          isOccupant: true,
        },
      });

      return lease;
    });
  }

  async addLeaseParty(dto: AddLeasePartyDto) {
    const lease = await this.prisma.rentalLease.findUnique({
      where: { id: dto.leaseId },
    });

    if (!lease) {
      throw new NotFoundException(`Lease with ID '${dto.leaseId}' not found.`);
    }

    const existing = await this.prisma.rentalLeaseParty.findUnique({
      where: {
        leaseId_personId: {
          leaseId: dto.leaseId,
          personId: dto.personId,
        },
      },
    });

    if (existing) {
      throw new ConflictException(`Person is already attached to this lease.`);
    }

    return this.prisma.rentalLeaseParty.create({
      data: dto,
    });
  }

  async activateLease(leaseId: string) {
    const lease = await this.prisma.rentalLease.findUnique({
      where: { id: leaseId },
      include: {
        unit: true,
      },
    });

    if (!lease) {
      throw new NotFoundException(`Lease with ID '${leaseId}' not found.`);
    }

    if (lease.status === RentalLeaseStatus.ACTIVE) {
      throw new BadRequestException(`Lease '${lease.leaseNumber}' is already ACTIVE.`);
    }

    // Invariant Check: Ensure no other active lease exists on this unit
    const activeLease = await this.prisma.rentalLease.findFirst({
      where: {
        unitId: lease.unitId,
        status: RentalLeaseStatus.ACTIVE,
        id: { not: leaseId },
      },
    });

    if (activeLease) {
      throw new ConflictException(
        `Unit '${lease.unit.unitNumber}' already has an active lease (${activeLease.leaseNumber}).`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Activate Lease
      const updatedLease = await tx.rentalLease.update({
        where: { id: leaseId },
        data: {
          status: RentalLeaseStatus.ACTIVE,
          activatedAt: new Date(),
        },
      });

      // 2. Set Unit Status to OCCUPIED
      await tx.rentalUnit.update({
        where: { id: lease.unitId },
        data: { status: RentalUnitStatus.OCCUPIED },
      });

      // 3. Initialize Billing Account for this lease
      const billingAccount = await tx.rentalBillingAccount.create({
        data: {
          organizationId: lease.organizationId,
          leaseId: lease.id,
          unitId: lease.unitId,
          currency: 'BDT',
          balance: 0.0,
          status: 'ACTIVE',
        },
      });

      // 4. Create Recurring Rent Charge Rule
      await tx.rentalRecurringChargeRule.create({
        data: {
          billingAccountId: billingAccount.id,
          chargeType: RentalChargeCategory.RENT,
          description: `Monthly Base Rent for Lease ${lease.leaseNumber}`,
          amount: lease.rentAmount,
          frequency: lease.billingFrequency,
          dueDay: lease.dueDay,
          isActive: true,
        },
      });

      // Create Service Charge Rule if applicable
      if (Number(lease.serviceCharge) > 0) {
        await tx.rentalRecurringChargeRule.create({
          data: {
            billingAccountId: billingAccount.id,
            chargeType: RentalChargeCategory.SERVICE_CHARGE,
            description: `Monthly Building Service Charge for Lease ${lease.leaseNumber}`,
            amount: lease.serviceCharge,
            frequency: lease.billingFrequency,
            dueDay: lease.dueDay,
            isActive: true,
          },
        });
      }

      // 5. Create Security Deposit Account
      if (Number(lease.securityDeposit) > 0) {
        await tx.rentalDepositAccount.create({
          data: {
            leaseId: lease.id,
            requiredAmount: lease.securityDeposit,
            heldAmount: 0.0,
            status: 'HELD',
          },
        });
      }

      return updatedLease;
    });
  }

  async findLeaseById(id: string) {
    const lease = await this.prisma.rentalLease.findUnique({
      where: { id },
      include: {
        unit: {
          include: { property: true },
        },
        parties: {
          include: { person: true },
        },
        billingAccounts: {
          include: {
            recurringRules: true,
            invoices: true,
          },
        },
        depositAccounts: true,
      },
    });

    if (!lease) {
      throw new NotFoundException(`Lease with ID '${id}' not found.`);
    }

    return lease;
  }
}
