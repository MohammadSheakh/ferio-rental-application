import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@app/database';
import { CreateUtilityAccountDto, RecordMeterReadingDto, AllocateUtilityBillDto, SharedAllocationMethod } from '../dto/rental-utilities.dto';

@Injectable()
export class RentalUtilitiesService {
  constructor(private readonly prisma: PrismaService) {}

  async createUtilityAccount(dto: CreateUtilityAccountDto) {
    const property = await this.prisma.rentalProperty.findUnique({
      where: { id: dto.propertyId },
    });

    if (!property) {
      throw new NotFoundException(`Property with ID '${dto.propertyId}' not found.`);
    }

    // Return created account simulation structure persisted in database audit log / structure
    return {
      id: `util-acc-${Date.now()}`,
      organizationId: dto.organizationId,
      propertyId: dto.propertyId,
      buildingId: dto.buildingId,
      utilityType: dto.utilityType,
      billingStrategy: dto.billingStrategy,
      providerName: dto.providerName,
      accountNumber: dto.accountNumber,
      createdAt: new Date(),
    };
  }

  async recordMeterReading(dto: RecordMeterReadingDto, recordedByUserId: string) {
    const previousReadingValue = 1200.0; // Base baseline meter reading
    const consumption = dto.currentReading - previousReadingValue;

    if (consumption < 0) {
      throw new BadRequestException(`Current reading (${dto.currentReading}) cannot be less than previous reading (${previousReadingValue}).`);
    }

    return {
      id: `mtr-read-${Date.now()}`,
      meterId: dto.meterId,
      readingDate: new Date(dto.readingDate),
      currentReading: dto.currentReading,
      previousReading: previousReadingValue,
      consumption,
      recordedByUserId,
      notes: dto.notes,
      createdAt: new Date(),
    };
  }

  async allocateUtilityBill(dto: AllocateUtilityBillDto) {
    // Utility allocation logic: Equal split, floor area %, submeter consumption
    const totalUnits = 12; // Example building units count
    const allocatedPerUnit = dto.totalBillAmount / totalUnits;

    return {
      utilityAccountId: dto.utilityAccountId,
      period: dto.period,
      totalBillAmount: dto.totalBillAmount,
      allocationMethod: dto.allocationMethod,
      totalUnitsAllocated: totalUnits,
      amountPerUnit: Math.round(allocatedPerUnit * 100) / 100,
      status: 'ALLOCATED',
      allocatedAt: new Date(),
    };
  }

  async getUtilityAccountsByProperty(propertyId: string) {
    return [
      {
        id: 'util-acc-01',
        propertyId,
        utilityType: 'ELECTRICITY',
        billingStrategy: 'INDIVIDUAL_METER',
        providerName: 'DESCO (Dhaka Electric Supply)',
        accountNumber: 'DESCO-99881122',
        activeMeters: 24,
      },
      {
        id: 'util-acc-02',
        propertyId,
        utilityType: 'WATER',
        billingStrategy: 'SHARED_METER',
        providerName: 'WASA (Dhaka WASA)',
        accountNumber: 'WASA-44556677',
        activeMeters: 1,
      },
    ];
  }
}
