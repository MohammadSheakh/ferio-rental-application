import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { TenantDatabaseManager } from '../../infrastructure/tenant/tenant-database.manager';
import { EntitlementService } from '../../infrastructure/entitlements/entitlement.service';
    import { AutomationService } from '../../features/automation/automation.service';
import { TenantLedgerService } from './tenant-ledger.service';
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

/** § Weeks 20–21 guarded lifecycle: which statuses may follow which. */
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  OPEN: ['TRIAGED', 'ASSIGNED', 'CLOSED'],
  TRIAGED: ['APPROVED', 'ASSIGNED', 'CLOSED'],
  ASSIGNED: ['SCHEDULED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'],
  SCHEDULED: ['IN_PROGRESS', 'RESOLVED', 'CLOSED'],
  IN_PROGRESS: ['WAITING_PARTS', 'RESOLVED', 'CLOSED'],
  WAITING_PARTS: ['IN_PROGRESS', 'RESOLVED', 'CLOSED'],
  RESOLVED: ['CONFIRMED', 'REOPENED', 'CLOSED'],
  CONFIRMED: ['CLOSED'],
  REOPENED: ['IN_PROGRESS', 'RESOLVED', 'CLOSED'],
  CLOSED: [],
};

@Injectable()
export class TenantMaintenanceService {
  constructor(
    private readonly tenantDbManager: TenantDatabaseManager,
    private readonly entitlements: EntitlementService,
    private readonly automation: AutomationService,
    private readonly ledger: TenantLedgerService,
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

    // § Weeks 20–21 estimate gate: a TRIAGED request with a pending
    // estimate must be APPROVED before work is assigned.
    if (
      request.status === MaintenanceStatus.TRIAGED &&
      request.approvalStatus === 'PENDING'
    ) {
      throw new BadRequestException(
        'Estimate is pending approval — approve before assigning work',
      );
    }
    if (request.approvalStatus === 'REJECTED') {
      throw new BadRequestException('Estimate was rejected — request is closed');
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
          estimatedCost: request.estimatedCost ?? null,
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

    // § Weeks 20–21: guarded lifecycle — no illegal jumps.
    const current = await db.maintenanceRequest.findUnique({
      where: { id: requestId },
      select: { status: true },
    });
    if (!current) throw new NotFoundException('Maintenance request not found');
    const allowed = ALLOWED_TRANSITIONS[current.status] ?? [];
    if (!allowed.includes(status)) {
      throw new BadRequestException(
        `Cannot move a ${current.status} request to ${status}`,
      );
    }

    const data: any = { status };
    if (
      status === MaintenanceStatus.RESOLVED ||
      status === MaintenanceStatus.CLOSED
    ) {
      data.resolvedAt = new Date();
    }
    if (status === MaintenanceStatus.IN_PROGRESS) {
      // Keep the active work order's clock in sync.
      const wo = await db.workOrder.findFirst({
        where: { maintenanceRequestId: requestId, status: 'IN_PROGRESS' },
        select: { id: true },
      });
      if (wo) {
        await db.workOrder.update({
          where: { id: wo.id },
          data: { startedAt: new Date() },
        });
      }
    }

    return db.maintenanceRequest.update({
      where: { id: requestId },
      data,
    });
  }

  /**
   * § Triage + estimate: staff classifies the issue, sets payer/urgency
   * and records an estimate. Moves OPEN → TRIAGED with approval PENDING.
   */
  async triageRequest(
    organizationId: string,
    requestId: string,
    input: {
      urgency?: MaintenanceUrgency;
      payer?: MaintenancePayer;
      scope?: MaintenanceScope;
      estimateAmount?: number;
      estimateNote?: string;
      triagedBy?: string;
    },
  ) {
    const db = await this.tenantDbManager.getTenantDatabase(organizationId);

    const request = await db.maintenanceRequest.findUnique({
      where: { id: requestId },
      select: { status: true },
    });
    if (!request) throw new NotFoundException('Maintenance request not found');
    if (request.status !== MaintenanceStatus.OPEN && request.status !== ('TRIAGED' as never)) {
      throw new BadRequestException(
        `Only OPEN/TRIAGED requests can be re-triaged (current: ${request.status})`,
      );
    }

    return db.maintenanceRequest.update({
      where: { id: requestId },
      data: {
        status: MaintenanceStatus.TRIAGED,
        ...(input.urgency ? { urgency: input.urgency } : {}),
        ...(input.payer ? { payer: input.payer } : {}),
        ...(input.scope ? { scope: input.scope } : {}),
        estimatedCost: input.estimateAmount ?? null,
        estimateNote: input.estimateNote ?? null,
        approvalStatus: 'PENDING',
      },
    });
  }

  /**
   * § Estimate approval gate — the payer side accepts/rejects the
   * triage estimate. Only APPROVED requests may be assigned work.
   */
  async decideEstimate(
    organizationId: string,
    requestId: string,
    input: { decision: 'APPROVE' | 'REJECT'; decidedBy: string; reason?: string },
  ) {
    const db = await this.tenantDbManager.getTenantDatabase(organizationId);

    const request = await db.maintenanceRequest.findUnique({
      where: { id: requestId },
    });
    if (!request) throw new NotFoundException('Maintenance request not found');
    if (request.approvalStatus !== 'PENDING') {
      throw new BadRequestException(
        `No pending estimate to ${input.decision.toLowerCase()} (current: ${request.approvalStatus ?? 'none'})`,
      );
    }

    if (input.decision === 'REJECT') {
      if (!input.reason?.trim()) {
        throw new BadRequestException('A rejection reason is required');
      }
      return db.maintenanceRequest.update({
        where: { id: requestId },
        data: {
          approvalStatus: 'REJECTED',
          approvedAt: new Date(),
          approvedBy: input.decidedBy,
          status: MaintenanceStatus.CLOSED,
          resolvedAt: new Date(),
        },
      });
    }

    return db.maintenanceRequest.update({
      where: { id: requestId },
      data: {
        approvalStatus: 'APPROVED',
        approvedAt: new Date(),
        approvedBy: input.decidedBy,
      },
    });
  }

  /**
   * § Weeks 20–21 completion + § Gate 5 ledger: mark a work order
   * COMPLETED with its actual cost and post the balanced expense entry.
   */
  async completeWorkOrder(
    organizationId: string,
    workOrderId: string,
    input: { cost?: number; afterPhotoUrl?: string; notes?: string },
  ) {
    const db = await this.tenantDbManager.getTenantDatabase(organizationId);

    const wo = await db.workOrder.findUnique({ where: { id: workOrderId } });
    if (!wo) throw new NotFoundException('Work order not found');
    if (wo.status === 'COMPLETED') return wo;

    const cost = input.cost ?? wo.cost ?? null;
    const updated = await db.workOrder.update({
      where: { id: workOrderId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        ...(cost != null ? { cost } : {}),
        ...(input.afterPhotoUrl ? { afterPhotoUrl: input.afterPhotoUrl } : {}),
        ...(input.notes ? { notes: input.notes } : {}),
      },
    });

    await db.maintenanceRequest.update({
      where: { id: wo.maintenanceRequestId },
      data: {
        status: MaintenanceStatus.RESOLVED,
        resolvedAt: new Date(),
        ...(cost != null ? { actualCost: cost } : {}),
      },
    });

    if (cost != null && cost > 0) {
      const request = await db.maintenanceRequest.findUnique({
        where: { id: wo.maintenanceRequestId },
        select: { payer: true },
      });
      await this.ledger.postWorkOrderCompleted(organizationId, workOrderId, {
        cost,
        payer: request?.payer ?? undefined,
        entryDate: new Date(),
      });
    }

    return updated;
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
