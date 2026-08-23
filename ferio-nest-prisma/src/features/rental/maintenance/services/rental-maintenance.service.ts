import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@app/database';
import { CreateMaintenanceRequestDto, CreateVendorProfileDto, CreateWorkOrderDto, UpdateWorkOrderStatusDto } from '../dto/rental-maintenance.dto';
import { RentalMaintenanceStatus, RentalWorkOrderStatus } from '@prisma/client';

@Injectable()
export class RentalMaintenanceService {
  constructor(private readonly prisma: PrismaService) {}

  async createRequest(dto: CreateMaintenanceRequestDto) {
    const property = await this.prisma.rentalProperty.findUnique({
      where: { id: dto.propertyId },
    });

    if (!property) {
      throw new NotFoundException(`Property with ID '${dto.propertyId}' not found.`);
    }

    return this.prisma.rentalMaintenanceRequest.create({
      data: {
        organizationId: dto.organizationId,
        propertyId: dto.propertyId,
        unitId: dto.unitId,
        reporterPersonId: dto.reporterPersonId,
        category: dto.category,
        urgency: dto.urgency,
        description: dto.description,
        photos: dto.photos || [],
        whatsappMessageId: dto.whatsappMessageId,
        status: RentalMaintenanceStatus.OPEN,
      },
    });
  }

  async findAllRequests(organizationId: string) {
    return this.prisma.rentalMaintenanceRequest.findMany({
      where: { organizationId },
      include: {
        property: true,
        unit: true,
        workOrders: { include: { vendor: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createVendorProfile(dto: CreateVendorProfileDto) {
    return this.prisma.rentalVendorProfile.create({
      data: dto,
    });
  }

  async createWorkOrder(dto: CreateWorkOrderDto) {
    const request = await this.prisma.rentalMaintenanceRequest.findUnique({
      where: { id: dto.requestId },
    });

    if (!request) {
      throw new NotFoundException(`Maintenance Request with ID '${dto.requestId}' not found.`);
    }

    return this.prisma.$transaction(async (tx) => {
      const workOrder = await tx.rentalWorkOrder.create({
        data: {
          requestId: dto.requestId,
          vendorId: dto.vendorId,
          estimatedCost: dto.estimatedCost,
          scheduledDate: dto.scheduledDate ? new Date(dto.scheduledDate) : undefined,
          status: RentalWorkOrderStatus.ASSIGNED,
        },
      });

      await tx.rentalMaintenanceRequest.update({
        where: { id: dto.requestId },
        data: { status: RentalMaintenanceStatus.ASSIGNED },
      });

      return workOrder;
    });
  }

  async updateWorkOrderStatus(workOrderId: string, dto: UpdateWorkOrderStatusDto) {
    const workOrder = await this.prisma.rentalWorkOrder.findUnique({
      where: { id: workOrderId },
    });

    if (!workOrder) {
      throw new NotFoundException(`Work Order with ID '${workOrderId}' not found.`);
    }

    return this.prisma.$transaction(async (tx) => {
      const updatedWorkOrder = await tx.rentalWorkOrder.update({
        where: { id: workOrderId },
        data: {
          status: dto.status,
          actualCost: dto.actualCost,
          notes: dto.notes,
          completedDate: dto.status === RentalWorkOrderStatus.COMPLETED ? new Date() : undefined,
        },
      });

      if (dto.status === RentalWorkOrderStatus.COMPLETED) {
        await tx.rentalMaintenanceRequest.update({
          where: { id: workOrder.requestId },
          data: { status: RentalMaintenanceStatus.RESOLVED },
        });
      }

      return updatedWorkOrder;
    });
  }
}
