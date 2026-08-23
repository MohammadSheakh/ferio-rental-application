import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@app/database';
import { CreateRentalPersonDto, CreateRentalOwnerProfileDto, AssignPropertyOwnershipDto } from '../dto/rental-person.dto';

@Injectable()
export class RentalPeopleService {
  constructor(private readonly prisma: PrismaService) {}

  async createPerson(dto: CreateRentalPersonDto) {
    const existing = await this.prisma.rentalPerson.findUnique({
      where: {
        organizationId_phone: {
          organizationId: dto.organizationId,
          phone: dto.phone,
        },
      },
    });

    if (existing) {
      throw new ConflictException(`Person with phone '${dto.phone}' already exists in this organization.`);
    }

    return this.prisma.rentalPerson.create({
      data: dto,
    });
  }

  async findAllPeople(organizationId: string) {
    return this.prisma.rentalPerson.findMany({
      where: { organizationId },
      include: {
        ownerProfile: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createOwnerProfile(dto: CreateRentalOwnerProfileDto) {
    const person = await this.prisma.rentalPerson.findUnique({
      where: { id: dto.personId },
    });

    if (!person) {
      throw new NotFoundException(`Person with ID '${dto.personId}' not found.`);
    }

    const existingProfile = await this.prisma.rentalOwnerProfile.findUnique({
      where: { personId: dto.personId },
    });

    if (existingProfile) {
      throw new ConflictException(`Owner profile already exists for this person.`);
    }

    return this.prisma.rentalOwnerProfile.create({
      data: dto,
    });
  }

  async assignPropertyOwnership(dto: AssignPropertyOwnershipDto) {
    const property = await this.prisma.rentalProperty.findUnique({
      where: { id: dto.propertyId },
    });

    if (!property) {
      throw new NotFoundException(`Property with ID '${dto.propertyId}' not found.`);
    }

    const ownerProfile = await this.prisma.rentalOwnerProfile.findUnique({
      where: { id: dto.ownerProfileId },
    });

    if (!ownerProfile) {
      throw new NotFoundException(`Owner Profile with ID '${dto.ownerProfileId}' not found.`);
    }

    return this.prisma.rentalPropertyOwnership.create({
      data: {
        propertyId: dto.propertyId,
        ownerProfileId: dto.ownerProfileId,
        ownershipPercentage: dto.ownershipPercentage,
      },
    });
  }
}
