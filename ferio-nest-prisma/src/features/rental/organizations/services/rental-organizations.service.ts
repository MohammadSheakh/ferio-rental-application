import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@app/database';
import { CreateRentalOrganizationDto, UpdateRentalOrganizationDto } from '../dto/rental-organization.dto';

@Injectable()
export class RentalOrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createDto: CreateRentalOrganizationDto, ownerUserId: string) {
    const existing = await this.prisma.rentalOrganization.findUnique({
      where: { code: createDto.code },
    });

    if (existing) {
      throw new ConflictException(`Organization code '${createDto.code}' is already taken.`);
    }

    return this.prisma.$transaction(async (tx) => {
      const org = await tx.rentalOrganization.create({
        data: {
          name: createDto.name,
          code: createDto.code,
          status: createDto.status,
          currency: createDto.currency || 'BDT',
          timezone: createDto.timezone || 'Asia/Dhaka',
        },
      });

      // Assign creator user as Organization Member
      await tx.rentalOrganizationMember.create({
        data: {
          organizationId: org.id,
          userId: ownerUserId,
          status: 'ACTIVE',
        },
      });

      return org;
    });
  }

  async findAllForUser(userId: string) {
    return this.prisma.rentalOrganization.findMany({
      where: {
        members: {
          some: {
            userId,
            status: 'ACTIVE',
          },
        },
      },
      include: {
        _count: {
          select: {
            properties: true,
            members: true,
            leases: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const org = await this.prisma.rentalOrganization.findUnique({
      where: { id },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true, role: true },
            },
          },
        },
        _count: {
          select: {
            properties: true,
            leases: true,
            invoices: true,
          },
        },
      },
    });

    if (!org) {
      throw new NotFoundException(`Rental Organization with ID '${id}' not found.`);
    }

    return org;
  }

  async update(id: string, updateDto: UpdateRentalOrganizationDto) {
    await this.findOne(id);

    return this.prisma.rentalOrganization.update({
      where: { id },
      data: updateDto,
    });
  }
}
