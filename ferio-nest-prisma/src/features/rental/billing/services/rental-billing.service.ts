import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@app/database';
import { CreateRentalInvoiceDto, RecordPaymentDto } from '../dto/rental-billing.dto';
import { RentalInvoiceStatus, RentalCashVerificationStatus, RentalDepositStatus, RentalDepositTxType } from '@prisma/client';

@Injectable()
export class RentalBillingService {
  constructor(private readonly prisma: PrismaService) {}

  async createInvoice(dto: CreateRentalInvoiceDto) {
    const account = await this.prisma.rentalBillingAccount.findUnique({
      where: { id: dto.billingAccountId },
    });

    if (!account) {
      throw new NotFoundException(`Billing Account with ID '${dto.billingAccountId}' not found.`);
    }

    const existingInvoice = await this.prisma.rentalInvoice.findUnique({
      where: { invoiceNumber: dto.invoiceNumber },
    });

    if (existingInvoice) {
      throw new ConflictException(`Invoice number '${dto.invoiceNumber}' already exists.`);
    }

    const subtotal = dto.lines.reduce((sum, line) => sum + Number(line.amount), 0);
    const dueDate = new Date(dto.dueDate);
    const gracePeriodEnd = new Date(dueDate);
    gracePeriodEnd.setDate(gracePeriodEnd.getDate() + 5);

    return this.prisma.$transaction(async (tx) => {
      // 1. Create Invoice & Lines
      const invoice = await tx.rentalInvoice.create({
        data: {
          organizationId: account.organizationId,
          billingAccountId: account.id,
          invoiceNumber: dto.invoiceNumber,
          period: dto.period,
          dueDate,
          gracePeriodEnd,
          subtotal,
          totalAmount: subtotal,
          balanceDue: subtotal,
          status: RentalInvoiceStatus.ISSUED,
          lines: {
            create: dto.lines.map((line) => ({
              chargeCategory: line.chargeCategory,
              description: line.description,
              amount: line.amount,
            })),
          },
        },
        include: { lines: true },
      });

      // 2. Update Billing Account balance
      const newAccountBalance = Number(account.balance) + subtotal;
      await tx.rentalBillingAccount.update({
        where: { id: account.id },
        data: { balance: newAccountBalance },
      });

      // 3. Post Double-Entry Ledger Record (Debit = Charge)
      await tx.rentalLedgerEntry.create({
        data: {
          organizationId: account.organizationId,
          billingAccountId: account.id,
          transactionType: 'CHARGE',
          debit: subtotal,
          credit: 0.0,
          balanceAfter: newAccountBalance,
          referenceType: 'INVOICE',
          referenceId: invoice.id,
          description: `Issued Invoice #${invoice.invoiceNumber} for period ${dto.period}`,
        },
      });

      return invoice;
    });
  }

  async recordPayment(dto: RecordPaymentDto, recordedByUserId: string) {
    const account = await this.prisma.rentalBillingAccount.findUnique({
      where: { id: dto.billingAccountId },
    });

    if (!account) {
      throw new NotFoundException(`Billing Account with ID '${dto.billingAccountId}' not found.`);
    }

    const existingPayment = await this.prisma.rentalPayment.findUnique({
      where: { paymentNumber: dto.paymentNumber },
    });

    if (existingPayment) {
      throw new ConflictException(`Payment number '${dto.paymentNumber}' already exists.`);
    }

    const paymentAmount = Number(dto.amount);

    return this.prisma.$transaction(async (tx) => {
      // 1. Record Payment
      const payment = await tx.rentalPayment.create({
        data: {
          organizationId: account.organizationId,
          billingAccountId: account.id,
          paymentNumber: dto.paymentNumber,
          amount: paymentAmount,
          paymentMethod: dto.paymentMethod,
          providerReference: dto.providerReference,
          recordedByUserId,
          verificationStatus: dto.paymentMethod === 'CASH'
            ? RentalCashVerificationStatus.PENDING_VERIFICATION
            : RentalCashVerificationStatus.VERIFIED,
        },
      });

      // 2. Allocate Payment to Target Invoice if provided
      if (dto.targetInvoiceId) {
        const invoice = await tx.rentalInvoice.findUnique({
          where: { id: dto.targetInvoiceId },
        });

        if (invoice) {
          const currentBalanceDue = Number(invoice.balanceDue);
          const allocatedAmount = Math.min(paymentAmount, currentBalanceDue);
          const newBalanceDue = currentBalanceDue - allocatedAmount;
          const newPaidAmount = Number(invoice.paidAmount) + allocatedAmount;

          const newInvoiceStatus = newBalanceDue === 0
            ? RentalInvoiceStatus.PAID
            : RentalInvoiceStatus.PARTIALLY_PAID;

          await tx.rentalPaymentAllocation.create({
            data: {
              paymentId: payment.id,
              invoiceId: invoice.id,
              allocatedAmount,
            },
          });

          await tx.rentalInvoice.update({
            where: { id: invoice.id },
            data: {
              paidAmount: newPaidAmount,
              balanceDue: newBalanceDue,
              status: newInvoiceStatus,
            },
          });
        }
      }

      // 3. Update Billing Account balance (subtract payment)
      const newAccountBalance = Number(account.balance) - paymentAmount;
      await tx.rentalBillingAccount.update({
        where: { id: account.id },
        data: { balance: newAccountBalance },
      });

      // 4. Post Double-Entry Ledger Record (Credit = Payment)
      await tx.rentalLedgerEntry.create({
        data: {
          organizationId: account.organizationId,
          billingAccountId: account.id,
          transactionType: 'PAYMENT',
          debit: 0.0,
          credit: paymentAmount,
          balanceAfter: newAccountBalance,
          referenceType: 'PAYMENT',
          referenceId: payment.id,
          description: `Recorded ${dto.paymentMethod} Payment #${payment.paymentNumber}`,
        },
      });

      return payment;
    });
  }

  async getTenantLedger(billingAccountId: string) {
    const account = await this.prisma.rentalBillingAccount.findUnique({
      where: { id: billingAccountId },
      include: {
        lease: {
          include: {
            unit: true,
            parties: { include: { person: true } },
          },
        },
      },
    });

    if (!account) {
      throw new NotFoundException(`Billing Account with ID '${billingAccountId}' not found.`);
    }

    const entries = await this.prisma.rentalLedgerEntry.findMany({
      where: { billingAccountId },
      orderBy: { occurredAt: 'asc' },
    });

    return {
      billingAccount: account,
      currentBalance: account.balance,
      ledgerEntries: entries,
    };
  }

  async verifyCashPayment(paymentId: string, verifierUserId: string, approved: boolean) {
    const payment = await this.prisma.rentalPayment.findUnique({
      where: { id: paymentId },
    });

    if (!payment) {
      throw new NotFoundException(`Payment with ID '${paymentId}' not found.`);
    }

    const verificationStatus = approved
      ? RentalCashVerificationStatus.VERIFIED
      : RentalCashVerificationStatus.REJECTED;

    return this.prisma.rentalPayment.update({
      where: { id: paymentId },
      data: { verificationStatus },
    });
  }

  async getPendingCashPayments(organizationId: string) {
    return this.prisma.rentalPayment.findMany({
      where: {
        organizationId,
        paymentMethod: 'CASH',
        verificationStatus: RentalCashVerificationStatus.PENDING_VERIFICATION,
      },
      include: {
        billingAccount: {
          include: {
            lease: {
              include: {
                unit: true,
                parties: { include: { person: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async recordDepositTransaction(dto: {
    leaseId: string;
    type: 'COLLECTION' | 'DEDUCTION' | 'REFUND';
    amount: number;
    notes?: string;
  }) {
    const depositAccount = await this.prisma.rentalDepositAccount.findFirst({
      where: { leaseId: dto.leaseId },
    });

    if (!depositAccount) {
      throw new NotFoundException(`Deposit Account for lease '${dto.leaseId}' not found.`);
    }

    const currentHeld = Number(depositAccount.heldAmount);
    let newHeld = currentHeld;
    let txType: RentalDepositTxType = RentalDepositTxType.INITIAL_DEPOSIT;

    if (dto.type === 'COLLECTION') {
      newHeld += dto.amount;
      txType = RentalDepositTxType.INITIAL_DEPOSIT;
    } else if (dto.type === 'DEDUCTION') {
      if (dto.amount > currentHeld) {
        throw new BadRequestException(`Cannot deduct ৳${dto.amount}. Current held deposit balance is ৳${currentHeld}.`);
      }
      newHeld -= dto.amount;
      txType = RentalDepositTxType.DEDUCTION_DAMAGE;
    } else if (dto.type === 'REFUND') {
      if (dto.amount > currentHeld) {
        throw new BadRequestException(`Cannot refund ৳${dto.amount}. Current held deposit balance is ৳${currentHeld}.`);
      }
      newHeld -= dto.amount;
      txType = RentalDepositTxType.REFUND;
    }

    return this.prisma.$transaction(async (tx) => {
      const depositTx = await tx.rentalDepositTransaction.create({
        data: {
          depositAccountId: depositAccount.id,
          transactionType: txType,
          amount: dto.amount,
          notes: dto.notes,
        },
      });

      let nextStatus: RentalDepositStatus = RentalDepositStatus.HELD;
      if (newHeld === 0 && dto.type === 'REFUND') {
        nextStatus = RentalDepositStatus.FULLY_REFUNDED;
      } else if (dto.type === 'REFUND') {
        nextStatus = RentalDepositStatus.PARTIALLY_REFUNDED;
      }

      const updatedAccount = await tx.rentalDepositAccount.update({
        where: { id: depositAccount.id },
        data: {
          heldAmount: newHeld,
          status: nextStatus,
        },
      });

      return {
        transaction: depositTx,
        depositAccount: updatedAccount,
      };
    });
  }
}
