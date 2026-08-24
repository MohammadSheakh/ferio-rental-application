import { BadRequestException, Injectable } from '@nestjs/common';
import {
  ChargeCategory,
  PaymentMethod,
} from '@prisma/tenant-client';
import { TenantDatabaseManager } from '../../infrastructure/tenant/tenant-database.manager';

/** Cash-equivalent ledger account per payment method. */
const CASH_ACCOUNT: Record<string, string> = {
  BKASH: 'BKASH',
  NAGAD: 'NAGAD',
  BANK: 'BANK',
  CHEQUE: 'BANK',
  CASH: 'CASH',
  OTHER: 'CASH',
};

const TOLERANCE = 0.005; // half a paisa

export interface LedgerLegInput {
  account: string;
  debit?: number;
  credit?: number;
  memo?: string;
}

export interface TrialBalanceRow {
  account: string;
  totalDebit: number;
  totalCredit: number;
  /** debit-positive balance */
  balance: number;
}

/**
 * § Week 15 / Gate 5 — double-entry ledger.
 *
 * Every posting is a GROUP of legs with Σ debit == Σ credit enforced
 * before insert (no unbalanced books by construction). Groups:
 *   payment:verify:<id>   cash-in vs receivable split by invoice lines
 *   payment:reverse:<id>  exact compensating group
 *   wo-complete:<id>      maintenance expense vs accounts payable
 */
@Injectable()
export class TenantLedgerService {
  constructor(private readonly tenantDbManager: TenantDatabaseManager) {}

  /**
   * Post the verification of a renter payment:
   *   debit cash-equivalent (method) · credit per-category receivables,
   * split proportionally across the invoice's lines (largest remainder
   * in paisa so the split sums to the payment exactly).
   */
  async postPaymentVerified(
    organizationId: string,
    paymentId: string,
    opts: { method: string; amount: number; invoiceId: string; entryDate: Date },
  ) {
    const db = await this.tenantDbManager.getTenantDatabase(organizationId);

    const invoice = await db.invoice.findUnique({
      where: { id: opts.invoiceId },
      include: { lines: true },
    });
    if (!invoice) throw new BadRequestException('Payment references a missing invoice');

    const legs: LedgerLegInput[] = [
      {
        account: CASH_ACCOUNT[opts.method] ?? 'CASH',
        debit: opts.amount,
        memo: `Receipt against ${invoice.invoiceNumber}`,
      },
    ];
    const split = splitByProportion(
      opts.amount,
      invoice.lines.map((l) => ({ key: l.category as string, weight: l.amount })),
    );
    for (const part of split) {
      legs.push({
        account: receivableAccount(part.key),
        credit: part.amount,
        memo: `${part.key} collected on ${invoice.invoiceNumber}`,
      });
    }

    return this.postGroup(organizationId, `payment:verify:${paymentId}`, legs, {
      refType: 'Payment',
      refId: paymentId,
    });
  }

  /** Exact compensating group for a reversed payment. */
  async postPaymentReversed(
    organizationId: string,
    paymentId: string,
    opts: { method: string; amount: number; invoiceId: string; entryDate: Date },
  ) {
    const db = await this.tenantDbManager.getTenantDatabase(organizationId);
    const original = await db.ledgerEntry.findMany({
      where: { groupId: `payment:verify:${paymentId}` },
    });
    if (!original.length) {
      // Payment verified before the ledger existed — nothing to reverse.
      return { posted: 0 };
    }

    const legs: LedgerLegInput[] = original.map((e) => ({
      account: e.account,
      debit: e.credit,
      credit: e.debit,
      memo: `Reversal of ${e.groupId}`,
    }));
    void opts;
    return this.postGroup(organizationId, `payment:reverse:${paymentId}`, legs, {
      refType: 'Payment',
      refId: paymentId,
    });
  }

  /**
   * Work order completed at a cost: debit MAINTENANCE_EXPENSE,
   * credit ACCOUNTS_PAYABLE (owed to crew/vendor until settlement).
   */
  async postWorkOrderCompleted(
    organizationId: string,
    workOrderId: string,
    opts: { cost: number; payer?: string; entryDate: Date },
  ) {
    const creditAccount =
      opts.payer === 'RENTER' ? 'RENTER_PAYABLE' : 'ACCOUNTS_PAYABLE';
    return this.postGroup(
      organizationId,
      `wo-complete:${workOrderId}`,
      [
        { account: 'MAINTENANCE_EXPENSE', debit: opts.cost, memo: 'Maintenance work completed' },
        { account: creditAccount, credit: opts.cost, memo: `Payable (${opts.payer ?? 'VENDOR'})` },
      ],
      { refType: 'WorkOrder', refId: workOrderId },
    );
  }

  /**
   * Insert a balanced group atomically. Rejects any group whose sides do
   * not match — the ledger cannot go out of balance through this door.
   */
  async postGroup(
    organizationId: string,
    groupId: string,
    legs: LedgerLegInput[],
    meta: { refType?: string; refId?: string } = {},
  ) {
    const existing = await this.findByGroup(organizationId, groupId);
    if (existing.length) return { posted: 0, groupId, entries: existing };

    const totalDebit = round2(legs.reduce((s, l) => s + (l.debit ?? 0), 0));
    const totalCredit = round2(legs.reduce((s, l) => s + (l.credit ?? 0), 0));
    if (legs.length < 2) {
      throw new BadRequestException('A posting needs at least two legs');
    }
    if (Math.abs(totalDebit - totalCredit) > TOLERANCE) {
      throw new BadRequestException(
        `Unbalanced posting rejected: debit ${totalDebit} ≠ credit ${totalCredit}`,
      );
    }

    const db = await this.tenantDbManager.getTenantDatabase(organizationId);
    const now = new Date();
    const rows = await db.$transaction(async (tx) =>
      tx.ledgerEntry.createManyAndReturn({
        data: legs.map((l) => ({
          groupId,
          entryDate: now,
          account: l.account,
          debit: round2(l.debit ?? 0),
          credit: round2(l.credit ?? 0),
          refType: meta.refType ?? null,
          refId: meta.refId ?? null,
          memo: l.memo ?? null,
        })),
      }),
    );
    return { posted: rows.length, groupId, entries: rows };
  }

  async findByGroup(organizationId: string, groupId: string) {
    const db = await this.tenantDbManager.getTenantDatabase(organizationId);
    return db.ledgerEntry.findMany({ where: { groupId }, orderBy: { createdAt: 'asc' } });
  }

  /** Per-account totals + global drift check (must always be zero). */
  async trialBalance(organizationId: string): Promise<{
    rows: TrialBalanceRow[];
    totalDebit: number;
    totalCredit: number;
    drift: number;
    balanced: boolean;
  }> {
    const db = await this.tenantDbManager.getTenantDatabase(organizationId);
    const grouped = await db.ledgerEntry.groupBy({
      by: ['account'],
      _sum: { debit: true, credit: true },
      orderBy: { account: 'asc' },
    });
    const rows: TrialBalanceRow[] = grouped.map((g) => ({
      account: g.account,
      totalDebit: round2(g._sum.debit ?? 0),
      totalCredit: round2(g._sum.credit ?? 0),
      balance: round2((g._sum.debit ?? 0) - (g._sum.credit ?? 0)),
    }));
    const totalDebit = round2(rows.reduce((s, r) => s + r.totalDebit, 0));
    const totalCredit = round2(rows.reduce((s, r) => s + r.totalCredit, 0));
    const drift = round2(totalDebit - totalCredit);
    return {
      rows,
      totalDebit,
      totalCredit,
      drift,
      balanced: Math.abs(drift) <= TOLERANCE,
    };
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Split `amount` across weighted buckets with largest-remainder rounding
 * in paisa — Σ parts == amount exactly.
 */
export function splitByProportion(
  amount: number,
  weighted: Array<{ key: string; weight: number }>,
): Array<{ key: string; amount: number }> {
  const nonZero = weighted.filter((w) => w.weight > 0);
  const usable = nonZero.length ? nonZero : weighted.slice(0, 1).map((w) => ({ ...w, weight: 1 }));
  const totalWeight = usable.reduce((s, w) => s + w.weight, 0);
  const totalPaisa = Math.round(amount * 100);

  const raw = usable.map((w) => ({
    key: w.key,
    exactPaisa: (w.weight / totalWeight) * totalPaisa,
  }));
  const floors = raw.map((r) => ({ key: r.key, paisa: Math.floor(r.exactPaisa) }));
  let remainder = totalPaisa - floors.reduce((s, f) => s + f.paisa, 0);
  const order = raw
    .map((r) => ({ key: r.key, frac: r.exactPaisa - Math.floor(r.exactPaisa) }))
    .sort((a, b) => b.frac - a.frac);
  let i = 0;
  while (remainder > 0 && order.length) {
    floors.find((f) => f.key === order[i % order.length].key)!.paisa += 1;
    remainder -= 1;
    i += 1;
  }
  return floors.map((f) => ({ key: f.key, amount: f.paisa / 100 }));
}

/** `{CATEGORY}_RECEIVABLE` account name for a charge category. */
export function receivableAccount(category: string | ChargeCategory): string {
  return `${String(category)}_RECEIVABLE`;
}

export function cashAccountFor(method: PaymentMethod | string): string {
  return CASH_ACCOUNT[String(method)] ?? 'CASH';
}
