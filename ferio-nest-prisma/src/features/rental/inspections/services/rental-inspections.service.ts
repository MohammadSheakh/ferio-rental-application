import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@app/database';
import { CreateInspectionDto } from '../dto/rental-inspections.dto';

@Injectable()
export class RentalInspectionsService {
  constructor(private readonly prisma: PrismaService) {}

  async createInspection(dto: CreateInspectionDto, inspectorUserId: string) {
    const unit = await this.prisma.rentalUnit.findUnique({
      where: { id: dto.unitId },
    });

    if (!unit) {
      throw new NotFoundException(`Unit with ID '${dto.unitId}' not found.`);
    }

    return {
      id: `insp-${Date.now()}`,
      organizationId: dto.organizationId,
      propertyId: dto.propertyId,
      unitId: dto.unitId,
      leaseId: dto.leaseId,
      inspectionType: dto.inspectionType,
      inspectorUserId,
      status: 'COMPLETED',
      itemsCount: dto.items.length,
      damagedItemsCount: dto.items.filter((i) => i.condition === 'DAMAGED' || i.condition === 'MISSING').length,
      items: dto.items,
      createdAt: new Date(),
    };
  }

  async getInspectionsByUnit(unitId: string) {
    return [
      {
        id: 'insp-101',
        unitId,
        inspectionType: 'MOVE_IN',
        status: 'COMPLETED',
        inspector: 'Caretaker Rafiqul Islam',
        date: '01 Sep 2025',
        damagedItems: 0,
      },
      {
        id: 'insp-102',
        unitId,
        inspectionType: 'MOVE_OUT',
        status: 'COMPLETED',
        inspector: 'Property Manager Subrata',
        date: '22 Aug 2026',
        damagedItems: 1, // Pipe leakage damage
      },
    ];
  }
}
