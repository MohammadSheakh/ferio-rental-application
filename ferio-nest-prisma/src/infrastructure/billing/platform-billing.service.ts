import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import {
  ControlPlanePrismaService,
} from '../control-plane/control-plane-prisma.service';
import { PlatformInvoiceStatus } from '@prisma/control-client';

const PAID_VIA = ['BKASH', 'NAGAD', 'BANK', 'GATEWAY'] as const;

/**
 * § Week 27 Platform Billing — Organization → Ferio subscription fees.
 *
 * One DUE invoice per ACTIVE subscription per period (idempotent via
 * unique [subscriptionId, periodKey]). Payments are off-platform
 * transfers confirmed by Ferio staff (same trust model as §23
 * promotions) — self-serve payment collection is a future gateway
 * integration.
 *
 * This ledger is separate from rent (tenant DBs) and promotion revenue
 * (marketplace DB) per §11 money-flow separation.
 */
@Injectable()
export class PlatformBillingService {
  private readonly logger = new Logger(PlatformBillingService.name);

  constructor(private readonly controlPlane: ControlPlanePrismaService) {}

  /**
   * Create the invoice for a subscription's current period if missing.
   * Called after provisioning/self-serve subscribe and by the scan job.
   */
  async ensurePeriodInvoice(subscriptionId: string) {
    const sub = await this.controlPlane.subscription.findUnique({
      where: { id: subscriptionId },
      include: { plan: true },
    });
    if (!sub) throw new NotFoundException('Subscription not found');

    const periodKey = sub.currentPeriodStart.toISOString().slice(0, 7);
    const existing = await this.controlPlane.platformInvoice.findUnique({
      where: { subscriptionId_periodKey: { subscriptionId, periodKey } },
    });
    if (existing) return existing;

    return this.controlPlane.platformInvoice.create({
      data: {
        organizationId: sub.organizationId,
        subscriptionId,
        periodStart: sub.currentPeriodStart,
        periodEnd: sub.currentPeriodEnd,
        periodKey,
        amountBdt: sub.plan.monthlyPriceBdt,
        dueDate: new Date(
          sub.currentPeriodStart.getTime() + 14 * 86_400_000,
        ),
        status: PlatformInvoiceStatus.DUE,
      },
    });
  }

  /** Scan all ACTIVE subscriptions → create any missing period invoices. */
  async generateDueInvoices() {
    const active = await this.controlPlane.subscription.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true },
    });
    let created = 0;
    for (const sub of active) {
      const before = await this.controlPlane.platformInvoice.count({
        where: { subscriptionId: sub.id },
      });
      await this.ensurePeriodInvoice(sub.id).catch(() => null);
      const after = await this.controlPlane.platformInvoice.count({
        where: { subscriptionId: sub.id },
      });
      created += after - before;
    }
    this.logger.log(
      `💳 Subscription invoice scan: ${active.length} checked, ${created} invoices created`,
    );
    return { subscriptionsChecked: active.length, invoicesCreated: created };
  }

  /**
   * Staff confirms an off-platform payment. Invoice flips PAID when the
   * cumulative payments cover amountBdt (within 1 paisa tolerance).
   */
  async recordPayment(
    invoiceId: string,
    dto: { method: string; amountBdt?: number; reference?: string },
    staffId: string | null | undefined,
  ) {
    if (!PAID_VIA.includes(dto.method as (typeof PAID_VIA)[number])) {
      throw new BadRequestException(`method must be one of ${PAID_VIA.join(', ')}`);
    }
    const invoice = await this.controlPlane.platformInvoice.findUnique({
      where: { id: invoiceId },
      include: { payments: true },
    });
    if (!invoice) throw new NotFoundException('Platform invoice not found');
    if (invoice.status === PlatformInvoiceStatus.VOID) {
      throw new BadRequestException('Cannot pay a VOID invoice');
    }
    if (invoice.status === PlatformInvoiceStatus.PAID) {
      throw new BadRequestException('Invoice is already fully paid');
    }

    const paidSoFar = invoice.payments.reduce((s, p) => s + p.amountBdt, 0);
    const amount =
      dto.amountBdt ?? Math.max(0, Math.round((invoice.amountBdt - paidSoFar) * 100) / 100);
    if (amount <= 0 || paidSoFar + amount > invoice.amountBdt + 0.01) {
      throw new BadRequestException(
        `Payment exceeds outstanding balance (${Math.round(paidSoFar * 100) / 100}/${invoice.amountBdt})`,
      );
    }

    const updated = await this.controlPlane.$transaction(async (tx) => {
      await tx.platformPayment.create({
        data: {
          invoiceId,
          amountBdt: amount,
          method: dto.method,
          reference: dto.reference ?? null,
          recordedBy: staffId ?? null,
        },
      });
      const fresh = await tx.platformInvoice.findUniqueOrThrow({
        where: { id: invoiceId },
        include: { payments: true },
      });
      const totalPaid = fresh.payments.reduce((s, p) => s + p.amountBdt, 0);
      const settled = totalPaid >= fresh.amountBdt - 0.01;
      return tx.platformInvoice.update({
        where: { id: invoiceId },
        data: {
          status: settled ? PlatformInvoiceStatus.PAID : PlatformInvoiceStatus.DUE,
          paidAt: settled ? new Date() : null,
        },
        include: { payments: true },
      });
    });

    // Audit trail
    await this.controlPlane.platformAuditEvent
      .create({
        data: {
          action: 'platform_billing.payment_recorded',
          actorType: 'PLATFORM_USER',
          actorId: staffId ?? null as unknown as string | null,
          resourceType: 'PlatformInvoice',
          resourceId: invoiceId,
          organizationId: invoice.organizationId,
          metadata: { amount, method: dto.method, reference: dto.reference ?? null } as any,
        },
      })
      .catch(() => {});

    return updated;
  }

  async listInvoices(organizationId?: string, status?: PlatformInvoiceStatus) {
    return this.controlPlane.platformInvoice.findMany({
      where: {
        ...(organizationId ? { organizationId } : {}),
        ...(status ? { status } : {}),
      },
      include: { payments: true, organization: { select: { slug: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }
}
