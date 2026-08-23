import { Injectable, NotFoundException } from '@nestjs/common';
import { TenantDatabaseManager } from '../../infrastructure/tenant/tenant-database.manager';
import { EntitlementService } from '../../infrastructure/entitlements/entitlement.service';
    import { AutomationService } from '../../features/automation/automation.service';
import {
  MaintenanceScope,
  MaintenanceUrgency,
  MaintenanceStatus,
  MaintenancePayer,
} from '@prisma/tenant-client';

export interface CreateMaintenanceRequestInput {
  unitId?: string;
  scope: MaintenanceScope;
  urgency?: MaintenanceUrgency;
  payer?: MaintenancePayer;
  title: string;
  description?: string;
  photoUrls?: string[];
  reportedBy?: string;
  reportedByName?: string;
}

export interface AssignWorkOrderInput {
  requestId: string;
  assignedTo: string;
  assignedPhone?: string;
  scheduledDate?: string;
  notes?: string;
  cost?: number;
}

@Injectable()
export class TenantMaintenanceService {
  constructor(
    private readonly tenantDbManager: TenantDatabaseManager,
    private readonly entitlements: EntitlementService,
    private readonly automation: AutomationService,
  ) {}

  async createMaintenanceRequest(
    organizationId: string,
    input: CreateMaintenanceRequestInput,
  ) {
    // Feature gate: maintenance CRM requires an entitled plan
    await this.entitlements.checkFeature(organizationId, 'hasMaintenance');

    const db = await this.tenantDbManager.getTenantDatabase(organizationId);

    const request = await db.maintenanceRequest.create({
      data: {
        unitId: input.unitId,
        scope: input.scope,
        urgency: input.urgency || MaintenanceUrgency.NORMAL,
        payer: input.payer || MaintenancePayer.BUILDING_MANAGEMENT,
        title: input.title,
        description: input.description,
        photoUrls: input.photoUrls || [],
        reportedBy: input.reportedBy,
        reportedByName: input.reportedByName,
        status: MaintenanceStatus.OPEN,
      },
    });

    // Fire MAINTENANCE_OPENED automation (best-effort)
    await this.automation
      .evaluate(organizationId, 'MAINTENANCE_OPENED', {
        refId: request.id,
        vars: { title: input.title, unitId: input.unitId ?? '' },
      })
      .catch(() => {});

    return request;
  }

  async assignWorkOrder(organizationId: string, input: AssignWorkOrderInput) {
    const db = await this.tenantDbManager.getTenantDatabase(organizationId);

    const request = await db.maintenanceRequest.findUnique({
      where: { id: input.requestId },
    });

    if (!request) {
      throw new NotFoundException('Maintenance request not found');
    }

    return db.$transaction(async (tx) => {
      const workOrder = await tx.workOrder.create({
        data: {
          maintenanceRequestId: input.requestId,
          assignedTo: input.assignedTo,
          assignedPhone: input.assignedPhone,
          scheduledDate: input.scheduledDate
            ? new Date(input.scheduledDate)
            : null,
          notes: input.notes,
          cost: input.cost,
          status: 'ASSIGNED',
        },
      });

      await tx.maintenanceRequest.update({
        where: { id: input.requestId },
        data: { status: MaintenanceStatus.ASSIGNED },
      });

      return workOrder;
    });
  }

  async updateStatus(
    organizationId: string,
    requestId: string,
    status: MaintenanceStatus,
  ) {
    const db = await this.tenantDbManager.getTenantDatabase(organizationId);

    const data: any = { status };
    if (
      status === MaintenanceStatus.RESOLVED ||
      status === MaintenanceStatus.CLOSED
    ) {
      data.resolvedAt = new Date();
    }

    return db.maintenanceRequest.update({
      where: { id: requestId },
      data,
    });
  }

  async listMaintenanceRequests(organizationId: string, unitId?: string) {
    const db = await this.tenantDbManager.getTenantDatabase(organizationId);

    const where: any = {};
    if (unitId) where.unitId = unitId;

    return db.maintenanceRequest.findMany({
      where,
      include: {
        unit: { select: { name: true, property: { select: { name: true } } } },
        workOrders: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
