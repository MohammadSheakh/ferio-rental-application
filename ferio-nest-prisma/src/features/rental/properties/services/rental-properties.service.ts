import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@app/database';
import { CreateRentalPropertyDto, CreateRentalUnitDto, UpdateRentalUnitStatusDto } from '../dto/rental-property.dto';
import { RentalUnitStatus } from '@prisma/client';

@Injectable()
export class RentalPropertiesService {
  constructor(private readonly prisma: PrismaService) {}

  async createProperty(dto: CreateRentalPropertyDto) {
    const existing = await this.prisma.rentalProperty.findUnique({
      where: {
        organizationId_code: {
          organizationId: dto.organizationId,
          code: dto.code,
        },
      },
    });

    if (existing) {
      throw new ConflictException(`Property code '${dto.code}' already exists in this organization.`);
    }

    return this.prisma.rentalProperty.create({
      data: dto,
    });
  }

  async findAllProperties(organizationId: string) {
    return this.prisma.rentalProperty.findMany({
      where: { organizationId },
      include: {
        buildings: true,
        _count: {
          select: {
            units: true,
            maintenanceRequests: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findPropertyById(id: string) {
    const property = await this.prisma.rentalProperty.findUnique({
      where: { id },
      include: {
        buildings: true,
        units: {
          orderBy: { unitNumber: 'asc' },
        },
        ownerships: {
          include: {
            ownerProfile: {
              include: {
                person: true,
              },
            },
          },
        },
      },
    });

    if (!property) {
      throw new NotFoundException(`Rental Property with ID '${id}' not found.`);
    }

    return property;
  }

  async createUnit(dto: CreateRentalUnitDto) {
    const property = await this.prisma.rentalProperty.findUnique({
      where: { id: dto.propertyId },
    });

    if (!property) {
      throw new NotFoundException(`Target Property '${dto.propertyId}' not found.`);
    }

    const existingUnit = await this.prisma.rentalUnit.findUnique({
      where: {
        propertyId_unitNumber: {
          propertyId: dto.propertyId,
          unitNumber: dto.unitNumber,
        },
      },
    });

    if (existingUnit) {
      throw new ConflictException(`Unit number '${dto.unitNumber}' already exists in this property.`);
    }

    return this.prisma.rentalUnit.create({
      data: {
        propertyId: dto.propertyId,
        buildingId: dto.buildingId,
        unitNumber: dto.unitNumber,
        floor: dto.floor,
        unitType: dto.unitType,
        bedrooms: dto.bedrooms,
        bathrooms: dto.bathrooms,
        balconies: dto.balconies,
        areaSqFt: dto.areaSqFt,
        marketRent: dto.marketRent,
        status: RentalUnitStatus.AVAILABLE,
      },
    });
  }

  async updateUnitStatus(unitId: string, dto: UpdateRentalUnitStatusDto) {
    const unit = await this.prisma.rentalUnit.findUnique({
      where: { id: unitId },
    });

    if (!unit) {
      throw new NotFoundException(`Rental Unit with ID '${unitId}' not found.`);
    }

    // Validate state machine transitions
    const currentStatus = unit.status;
    const newStatus = dto.status;

    if (currentStatus === RentalUnitStatus.OCCUPIED && newStatus === RentalUnitStatus.AVAILABLE) {
      throw new BadRequestException(
        'Cannot transition unit directly from OCCUPIED to AVAILABLE. Must go through move-out settlement.',
      );
    }

    return this.prisma.rentalUnit.update({
      where: { id: unitId },
      data: { status: newStatus },
    });
  }
}
