import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import {
  CommissionPayoutStatus,
  CrmLeadStatus,
  CrmLeadSource,
  LeadViewingStatus,
  LeaseStatus,
  PaymentMethod,
  UnitStatus,
} from '@prisma/tenant-client';
import { TenantDatabaseManager } from '../../infrastructure/tenant/tenant-database.manager';

/** Allowed status transitions (linear pipeline + LOST from any open stage). */
const LEAD_TRANSITIONS: Record<CrmLeadStatus, CrmLeadStatus[]> = {
  NEW: ['CONTACTED', 'VIEWING_SCHEDULED', 'NEGOTIATING', 'LOST'],
  CONTACTED: ['VIEWING_SCHEDULED', 'NEGOTIATING', 'LOST'],
  VIEWING_SCHEDULED: ['NEGOTIATING', 'CONTACTED', 'LOST'],
  NEGOTIATING: ['CONVERTED', 'LOST', 'VIEWING_SCHEDULED'],
  CONVERTED: [],
  LOST: ['NEW'], // re-open
};

export interface CreateLeadInput {
  name: string;
  phone?: string;
  email?: string;
  source?: CrmLeadSource;
  interestedUnitId?: string;
  assignedTo?: string;
  brokerName?: string;
  notes?: string;
}

export interface ConvertLeadInput {
  unitId: string;
  startDate: string;
  endDate: string;
  monthlyRent: number;
  securityDeposit?: number;
}

/**
 * Broker CRM Service (§ Week 30 groundwork)
 *
 * Lead pipeline for prospective renters — marketplace inquiries,
 * walk-ins, referrals — through to lease conversion, with broker
 * attribution and commission capture on the resulting lease.
 */
@Injectable()
export class TenantCrmService {
  constructor(private readonly tenantDbManager: TenantDatabaseManager) {}

  async createLead(organizationId: string, input: CreateLeadInput) {
    const db = await this.tenantDbManager.getTenantDatabase(organizationId);
    return db.crmLead.create({
      data: {
        name: input.name,
        phone: input.phone,
        email: input.email,
        source: input.source ?? 'OTHER',
        interestedUnitId: input.interestedUnitId,
        assignedTo: input.assignedTo,
        brokerName: input.brokerName,
        notes: input.notes,
      },
    });
  }

  async listLeads(
    organizationId: string,
    filters: { status?: CrmLeadStatus; assignedTo?: string } = {},
  ) {
    const db = await this.tenantDbManager.getTenantDatabase(organizationId);
    return db.crmLead.findMany({
      where: {
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.assignedTo ? { assignedTo: filters.assignedTo } : {}),
      },
      include: {
        convertedRenter: { select: { id: true, name: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 200,
    });
  }

  async updateLead(
    organizationId: string,
    leadId: string,
    changes: {
      status?: CrmLeadStatus;
      assignedTo?: string;
      phone?: string;
      email?: string;
      notes?: string;
      lostReason?: string;
    },
  ) {
    const db = await this.tenantDbManager.getTenantDatabase(organizationId);
    const lead = await db.crmLead.findUnique({ where: { id: leadId } });
    if (!lead) throw new NotFoundException('Lead not found');

    if (changes.status && changes.status !== lead.status) {
      const allowed = LEAD_TRANSITIONS[lead.status as CrmLeadStatus] ?? [];
      if (!allowed.includes(changes.status)) {
        throw new BadRequestException(
          `Cannot move lead ${lead.status} → ${changes.status}. Allowed: ${allowed.join(', ') || 'none'}`,
        );
      }
      if (changes.status === 'LOST' && !changes.lostReason && !lead.lostReason) {
        throw new BadRequestException('lostReason is required when marking a lead LOST');
      }
    }

    return db.crmLead.update({ where: { id: leadId }, data: changes });
  }

  /**
   * Convert a NEGOTIATING lead into a renter + ACTIVE lease in one
   * transaction; captures broker commission on the lease.
   */
  async convertLead(
    organizationId: string,
    leadId: string,
    input: ConvertLeadInput & { brokerCommissionPct?: number },
  ) {
    const db = await this.tenantDbManager.getTenantDatabase(organizationId);

    return db.$transaction(async (tx) => {
      const lead = await tx.crmLead.findUnique({ where: { id: leadId } });
      if (!lead) throw new NotFoundException('Lead not found');
      if (lead.status !== CrmLeadStatus.NEGOTIATING) {
        throw new ConflictException(
          `Only NEGOTIATING leads can convert (current: ${lead.status})`,
        );
      }

      const unit = await tx.unit.findUnique({
        where: { id: input.unitId },
        select: { id: true, status: true },
      });
      if (!unit) throw new NotFoundException('Unit not found');
      if (unit.status === UnitStatus.OCCUPIED) {
        throw new ConflictException('Unit is already occupied');
      }

      // Reuse an existing renter row by phone/email when possible.
      let renter = null as null | { id: string };
      if (lead.phone) {
        renter = await tx.renter.findFirst({ where: { phone: lead.phone } });
      }
      if (!renter && lead.email) {
        renter = await tx.renter.findFirst({ where: { email: lead.email } });
      }
      if (!renter) {
        renter = await tx.renter.create({
          data: { name: lead.name, phone: lead.phone, email: lead.email },
        });
      }

      const commissionAmount =
        input.brokerCommissionPct != null
          ? Math.round(((input.monthlyRent * input.brokerCommissionPct) / 100) * 100) / 100
          : null;

      const lease = await tx.lease.create({
        data: {
          unitId: input.unitId,
          renterId: renter.id,
          startDate: new Date(input.startDate),
          endDate: new Date(input.endDate),
          monthlyRent: input.monthlyRent,
          securityDeposit: input.securityDeposit ?? 0,
          status: LeaseStatus.ACTIVE,
          brokerName: lead.brokerName,
          brokerCommissionPct: input.brokerCommissionPct,
          brokerCommissionAmount: commissionAmount,
        },
      });

      await tx.unit.update({
        where: { id: input.unitId },
        data: { status: UnitStatus.OCCUPIED },
      });

      await tx.crmLead.update({
        where: { id: lead.id },
        data: { status: CrmLeadStatus.CONVERTED, convertedRenterId: renter.id },
      });

      // Week 30 tail — commission payout becomes DUE automatically.
      let payoutId: string | null = null;
      if (commissionAmount != null && commissionAmount > 0) {
        const payout = await tx.commissionPayout.create({
          data: {
            leaseId: lease.id,
            brokerName: lead.brokerName ?? 'Broker',
            amount: commissionAmount,
            status: CommissionPayoutStatus.DUE,
          },
        });
        payoutId = payout.id;
      }

      await tx.tenantAuditEvent.create({
        data: {
          action: 'crm.lead_converted',
          resourceType: 'CrmLead',
          resourceId: lead.id,
          metadata: {
            renterId: renter.id,
            leaseId: lease.id,
            brokerName: lead.brokerName,
            commissionPct: input.brokerCommissionPct ?? null,
            payoutId,
          },
        },
      });

      return {
        leadId: lead.id,
        renterId: renter.id,
        leaseId: lease.id,
        commissionAmount,
        payoutId,
      };
    });
  }

  // ────────────────────────────────────────────────────────────
  // Viewings (§ Week 30 tail)
  // ────────────────────────────────────────────────────────────

  async scheduleViewing(
    organizationId: string,
    leadId: string,
    input: { scheduledAt: string; notes?: string },
  ) {
    const db = await this.tenantDbManager.getTenantDatabase(organizationId);
    const lead = await db.crmLead.findUnique({
      where: { id: leadId },
      select: { id: true },
    });
    if (!lead) throw new NotFoundException('Lead not found');
    return db.leadViewing.create({
      data: {
        leadId,
        scheduledAt: new Date(input.scheduledAt),
        notes: input.notes,
      },
    });
  }

  async listViewings(organizationId: string, leadId: string) {
    const db = await this.tenantDbManager.getTenantDatabase(organizationId);
    return db.leadViewing.findMany({
      where: { leadId },
      orderBy: { scheduledAt: 'desc' },
    });
  }

  async updateViewing(
    organizationId: string,
    viewingId: string,
    changes: { status?: LeadViewingStatus; notes?: string; scheduledAt?: string },
  ) {
    const db = await this.tenantDbManager.getTenantDatabase(organizationId);
    return db.leadViewing.update({
      where: { id: viewingId },
      data: {
        ...(changes.status ? { status: changes.status } : {}),
        ...(changes.notes !== undefined ? { notes: changes.notes } : {}),
        ...(changes.scheduledAt ? { scheduledAt: new Date(changes.scheduledAt) } : {}),
      },
    });
  }

  // ────────────────────────────────────────────────────────────
  // Commission payouts (§ Week 30 tail)
  // ────────────────────────────────────────────────────────────

  async listPayouts(organizationId: string, status?: CommissionPayoutStatus) {
    const db = await this.tenantDbManager.getTenantDatabase(organizationId);
    return db.commissionPayout.findMany({
      where: status ? { status } : undefined,
      include: {
        lease: {
          select: {
            id: true,
            monthlyRent: true,
            brokerCommissionPct: true,
            unit: { select: { name: true, property: { select: { name: true } } } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Settle a DUE payout: record method/reference and mark PAID. */
  async settlePayout(
    organizationId: string,
    payoutId: string,
    input: { method: PaymentMethod; reference?: string; recordedBy?: string },
  ) {
    const db = await this.tenantDbManager.getTenantDatabase(organizationId);

    const payout = await db.commissionPayout.findUnique({ where: { id: payoutId } });
    if (!payout) throw new NotFoundException('Payout not found');
    if (payout.status === CommissionPayoutStatus.PAID) {
      throw new BadRequestException('Payout already settled');
    }

    const updated = await db.commissionPayout.update({
      where: { id: payoutId },
      data: {
        status: CommissionPayoutStatus.PAID,
        method: input.method,
        reference: input.reference,
        paidAt: new Date(),
        recordedBy: input.recordedBy,
      },
    });

    await db.tenantAuditEvent.create({
      data: {
        action: 'crm.payout_settled',
        resourceType: 'CommissionPayout',
        resourceId: payoutId,
        metadata: {
          amount: payout.amount,
          method: input.method,
          reference: input.reference ?? null,
        } as any,
      },
    }).catch(() => {});

    return updated;
  }

  /** Pipeline performance: counts per status + conversion rate. */
  async report(organizationId: string) {
    const db = await this.tenantDbManager.getTenantDatabase(organizationId);

    const grouped = await db.crmLead.groupBy({
      by: ['status'],
      _count: { _all: true },
    });

    const byStatus = Object.fromEntries(
      grouped.map((g) => [g.status as string, g._count._all]),
    );
    const total = grouped.reduce((s, g) => s + g._count._all, 0);
    const converted = byStatus['CONVERTED'] ?? 0;

    const byAssignee = await db.crmLead.groupBy({
      by: ['assignedTo', 'status'],
      where: { assignedTo: { not: null } },
      _count: { _all: true },
    });

    const assigneeMap: Record<string, { total: number; converted: number }> = {};
    for (const g of byAssignee) {
      const key = g.assignedTo!;
      assigneeMap[key] ??= { total: 0, converted: 0 };
      assigneeMap[key].total += g._count._all;
      if (g.status === 'CONVERTED') assigneeMap[key].converted += g._count._all;
    }

    return {
      totalLeads: total,
      byStatus,
      conversionRatePct: total ? Math.round((converted / total) * 1000) / 10 : 0,
      byAssignee: Object.entries(assigneeMap).map(([centralUserId, v]) => ({
        centralUserId,
        ...v,
      })),
    };
  }
}
