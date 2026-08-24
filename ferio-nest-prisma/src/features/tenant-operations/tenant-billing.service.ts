import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { TenantDatabaseManager } from '../../infrastructure/tenant/tenant-database.manager';
import { TenantLedgerService } from './tenant-ledger.service';
import { TenantWebhookService } from './tenant-webhook.service';
import {
  ChargeCategory,
  InvoiceStatus,
  PaymentMethod,
  PaymentStatus,
} from '@prisma/tenant-client';

export interface CreateChargeDefinitionInput {
  billingAccountId: string;
  category: ChargeCategory;
  label: string;
  amount: number;
  isRecurring?: boolean;
  beneficiaryName?: string;
  beneficiaryType?: string;
}

export interface GenerateInvoiceInput {
  unitId: string;
  periodStart: string;
  periodEnd: string;
  dueDate: string;
}

export interface RecordPaymentInput {
  invoiceId: string;
  method: PaymentMethod;
  amount: number;
  reference?: string;
  proofUrl?: string;
  notes?: string;
}

@Injectable()
export class TenantBillingService {
  constructor(
    private readonly tenantDbManager: TenantDatabaseManager,
    private readonly ledger: TenantLedgerService,
    private readonly webhooks: TenantWebhookService,
  ) {}

  /**
   * Get or create billing account for a unit.
   */
  async getOrCreateBillingAccount(organizationId: string, unitId: string) {
    const db = await this.tenantDbManager.getTenantDatabase(organizationId);

    const existing = await db.billingAccount.findUnique({
      where: { unitId },
      include: { charges: true },
    });

    if (existing) return existing;

    return db.billingAccount.create({
      data: { unitId },
      include: { charges: true },
    });
  }

  /**
   * Add a charge definition (rent, service charge, electricity, gas, internet) to a unit's billing account.
   */
  async addChargeDefinition(
    organizationId: string,
    input: CreateChargeDefinitionInput,
  ) {
    const db = await this.tenantDbManager.getTenantDatabase(organizationId);

    return db.chargeDefinition.create({
      data: {
        billingAccountId: input.billingAccountId,
        category: input.category,
        label: input.label,
        amount: input.amount,
        isRecurring: input.isRecurring ?? true,
        beneficiaryName: input.beneficiaryName,
        beneficiaryType: input.beneficiaryType || 'UNIT_OWNER',
      },
    });
  }

  /**
   * Generate an itemized monthly invoice with multi-beneficiary line routing.
   *
   * Idempotent (§Week 15): one invoice per billing account per calendar
   * period (`periodKey` unique). Regenerating returns the existing row.
   */
  async generateMonthlyInvoice(
    organizationId: string,
    input: GenerateInvoiceInput,
  ) {
    const db = await this.tenantDbManager.getTenantDatabase(organizationId);

    const billingAccount = await this.getOrCreateBillingAccount(
      organizationId,
      input.unitId,
    );

    if (!billingAccount.charges || billingAccount.charges.length === 0) {
      throw new BadRequestException(
        'No charge definitions configured for this billing account',
      );
    }

    const periodKey = new Date(input.periodStart).toISOString().slice(0, 7);
    const existing = await db.invoice.findUnique({
      where: {
        billingAccountId_periodKey: {
          billingAccountId: billingAccount.id,
          periodKey,
        },
      },
    });
    if (existing) return existing;

    const totalAmount = billingAccount.charges.reduce(
      (sum, c) => sum + c.amount,
      0,
    );

    const dateStr = periodKey.replace('-', '');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const invoiceNumber = `INV-${dateStr}-${randomSuffix}`;

    return db.invoice.create({
      data: {
        billingAccountId: billingAccount.id,
        invoiceNumber,
        periodKey,
        status: InvoiceStatus.ISSUED,
        periodStart: new Date(input.periodStart),
        periodEnd: new Date(input.periodEnd),
        dueDate: new Date(input.dueDate),
        totalAmount,
        paidAmount: 0,
        issuedAt: new Date(),
        lines: {
          create: billingAccount.charges.map((charge) => ({
            category: charge.category,
            label: charge.label,
            amount: charge.amount,
            beneficiaryName: charge.beneficiaryName,
            beneficiaryType: charge.beneficiaryType,
          })),
        },
      },
      include: {
        lines: true,
        billingAccount: {
          include: {
            unit: {
              select: {
                name: true,
                property: { select: { name: true } },
                ownership: true,
              },
            },
          },
        },
      },
    });
  }

  /**
   * Record a renter-reported payment (bKash, Nagad, Bank, Cash).
   * Enters PENDING/REPORTED — allocation happens on staff verification.
   */
  async recordPayment(organizationId: string, input: RecordPaymentInput) {
    const db = await this.tenantDbManager.getTenantDatabase(organizationId);

    const invoice = await db.invoice.findUnique({
      where: { id: input.invoiceId },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }
    if (input.amount <= 0) {
      throw new BadRequestException('Payment amount must be positive');
    }
    if (invoice.paidAmount + input.amount > invoice.totalAmount + 1e-9) {
      throw new BadRequestException(
        `Payment exceeds outstanding balance (paid ${invoice.paidAmount}/${invoice.totalAmount})`,
      );
    }

    return db.payment.create({
      data: {
        invoiceId: input.invoiceId,
        method: input.method,
        amount: input.amount,
        reference: input.reference,
        proofUrl: input.proofUrl,
        notes: input.notes,
        status: input.proofUrl ? PaymentStatus.REPORTED : PaymentStatus.PENDING,
        paidAt: new Date(),
      },
    });
  }

  /**
   * Staff verification (§Week 19): VERIFIED status allocates the amount
   * onto the invoice and issues a receipt number. Idempotent.
   */
  async verifyPayment(
    organizationId: string,
    paymentId: string,
    verifiedBy: string,
  ) {
    const db = await this.tenantDbManager.getTenantDatabase(organizationId);
    let transitioned = false;

    return db.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({ where: { id: paymentId } });
      if (!payment) throw new NotFoundException('Payment not found');
      if (payment.status === PaymentStatus.VERIFIED) return payment;
      if (
        ![PaymentStatus.PENDING, PaymentStatus.REPORTED]
          .map(String)
          .includes(String(payment.status))
      ) {
        throw new BadRequestException(`Cannot verify a ${payment.status} payment`);
      }

      const receiptNumber = `RCP-${payment.id.slice(-8).toUpperCase()}`;
      const updated = await tx.payment.update({
        where: { id: paymentId },
        data: {
          status: PaymentStatus.VERIFIED,
          verifiedBy,
          verifiedAt: new Date(),
          receiptNumber,
          rejectionReason: null,
        },
      });
      transitioned = true;

      await this.applyToInvoice(tx, payment.invoiceId, payment.amount);

      // § Gate 5: balanced double-entry posting (cash-in vs receivables)
      await this.ledger
        .postPaymentVerified(organizationId, paymentId, {
          method: payment.method,
          amount: payment.amount,
          invoiceId: payment.invoiceId,
          entryDate: new Date(),
        })
        .catch((err) => {
          void tx.tenantAuditEvent.create({
            data: {
              actorId: verifiedBy,
              action: 'ledger.post_failed',
              resourceType: 'Payment',
              resourceId: paymentId,
              metadata: { error: String(err?.message ?? err).slice(0, 300) },
            },
          });
        });

      await tx.tenantAuditEvent.create({
        data: {
          actorId: verifiedBy,
          action: 'payment.verified',
          resourceType: 'Payment',
          resourceId: paymentId,
          metadata: { amount: payment.amount, receiptNumber },
        },
      });

      return updated;
    }).then(async (verified) => {
      // § Week 33: fan out to subscribed webhooks (best-effort, only on
      // an actual PENDING/REPORTED → VERIFIED transition)
      if (transitioned && (verified as any)?.status === PaymentStatus.VERIFIED) {
        await this.webhooks
          .emit(organizationId, 'payment.verified', {
            paymentId,
            invoiceId: (verified as any)?.invoiceId ?? null,
            amount: (verified as any)?.amount,
            receiptNumber: (verified as any)?.receiptNumber,
          })
          .catch(() => {});
      }
      return verified;
    });
  }

  /** Reject an unverified report (wrong amount, bounced cheque…). */
  async rejectPayment(
    organizationId: string,
    paymentId: string,
    rejectedBy: string,
    reason: string,
  ) {
    const db = await this.tenantDbManager.getTenantDatabase(organizationId);

    return db.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({ where: { id: paymentId } });
      if (!payment) throw new NotFoundException('Payment not found');
      if (!reason?.trim()) {
        throw new BadRequestException('Rejection reason is required');
      }
      if (
        ![PaymentStatus.PENDING, PaymentStatus.REPORTED]
          .map(String)
          .includes(String(payment.status))
      ) {
        throw new BadRequestException(`Cannot reject a ${payment.status} payment`);
      }

      const updated = await tx.payment.update({
        where: { id: paymentId },
        data: {
          status: PaymentStatus.REJECTED,
          verifiedBy: rejectedBy,
          rejectionReason: reason.slice(0, 1000),
        },
      });

      await tx.tenantAuditEvent.create({
        data: {
          actorId: rejectedBy,
          action: 'payment.rejected',
          resourceType: 'Payment',
          resourceId: paymentId,
          metadata: { reason: reason.slice(0, 1000) },
        },
      });

      return updated;
    });
  }

  /**
   * Reverse a previously-verified/settled payment (cheque bounced later,
   * duplicate entry) — atomically decrements the invoice allocation.
   */
  async reversePayment(
    organizationId: string,
    paymentId: string,
    reversedBy: string,
    reason: string,
  ) {
    const db = await this.tenantDbManager.getTenantDatabase(organizationId);

    return db.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({ where: { id: paymentId } });
      if (!payment) throw new NotFoundException('Payment not found');
      if (
        ![PaymentStatus.VERIFIED, PaymentStatus.SETTLED]
          .map(String)
          .includes(String(payment.status))
      ) {
        throw new BadRequestException(`Cannot reverse a ${payment.status} payment`);
      }
      if (!reason?.trim()) {
        throw new BadRequestException('Reversal reason is required');
      }

      const updated = await tx.payment.update({
        where: { id: paymentId },
        data: {
          status: PaymentStatus.REVERSED,
          reversedAt: new Date(),
          verifiedBy: reversedBy,
          rejectionReason: reason.slice(0, 1000),
        },
      });

      await this.applyToInvoice(tx, payment.invoiceId, -payment.amount);

      // § Gate 5: compensating ledger group (books stay balanced)
      await this.ledger
        .postPaymentReversed(organizationId, paymentId, {
          method: payment.method,
          amount: payment.amount,
          invoiceId: payment.invoiceId,
          entryDate: new Date(),
        })
        .catch(() => {});

      await tx.tenantAuditEvent.create({
        data: {
          actorId: reversedBy,
          action: 'payment.reversed',
          resourceType: 'Payment',
          resourceId: paymentId,
          metadata: { delta: -payment.amount, reason: reason.slice(0, 1000) },
        },
      });

      return updated;
    });
  }

  /**
   * Allocate/deallocate a verified amount onto its invoice in one place:
   * recomputes PARTIALLY_PAID / PAID and un-pays on reversal.
   */
  private async applyToInvoice(
    tx: {
      invoice: {
        update(args: any): Promise<unknown>;
        findUnique(args: any): Promise<{
          id: string;
          totalAmount: number;
          paidAmount: number;
          status: InvoiceStatus;
        } | null>;
      };
    },
    invoiceId: string,
    delta: number,
  ): Promise<void> {
    const invoice = await tx.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) throw new NotFoundException('Invoice not found');

    const newPaid =
      Math.round((invoice.paidAmount + delta) * 100) / 100;
    let status = invoice.status;
    if (newPaid >= invoice.totalAmount && newPaid > 0) {
      status = InvoiceStatus.PAID;
    } else if (newPaid > 0) {
      status = InvoiceStatus.PARTIALLY_PAID;
    } else if (
      invoice.status === InvoiceStatus.PAID ||
      invoice.status === InvoiceStatus.PARTIALLY_PAID
    ) {
      status = InvoiceStatus.ISSUED;
    }

    await tx.invoice.update({
      where: { id: invoiceId },
      data: { paidAmount: Math.max(0, newPaid), status },
    });
  }

  /**
   * List invoices for a unit or across tenant workspace.
   */
  async listInvoices(organizationId: string, unitId?: string) {
    const db = await this.tenantDbManager.getTenantDatabase(organizationId);

    const where: any = {};
    if (unitId) {
      where.billingAccount = { unitId };
    }

    return db.invoice.findMany({
      where,
      include: {
        lines: true,
        payments: true,
        billingAccount: {
          include: {
            unit: {
              select: { name: true, property: { select: { name: true } } },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
