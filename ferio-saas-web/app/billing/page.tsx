'use client';

import { useCallback, useEffect, useState } from 'react';
import { Header } from '@/components/Header';
import { Plus, X } from 'lucide-react';
import {
  listInvoices,
  recordPayment,
  type Invoice,
} from '@/lib/api';

function money(n: number) {
  return `৳ ${n.toLocaleString('en-US', { minimumFractionDigits: 0 })}`;
}

function statusPill(status: string) {
  if (status === 'PAID')
    return <span className="status-pill status-pill-success">PAID</span>;
  if (status === 'OVERDUE')
    return <span className="status-pill status-pill-error">OVERDUE</span>;
  if (status === 'ISSUED' || status === 'PARTIALLY_PAID')
    return <span className="status-pill status-pill-warning">{status.replaceAll('_', ' ')}</span>;
  return <span className="status-pill status-pill-neutral">{status.replaceAll('_', ' ')}</span>;
}

export default function BillingPage() {
  const [activeTab, setActiveTab] = useState<'STATEMENTS' | 'CASH_VERIFICATION'>(
    'STATEMENTS',
  );

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payModalFor, setPayModalFor] = useState<Invoice | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setInvoices(await listInvoices());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load invoices');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const outstanding = invoices.reduce((s, i) => s + (i.totalAmount - i.paidAmount), 0);
  const collected = invoices.reduce((s, i) => s + i.paidAmount, 0);

  return (
    <div>
      <Header
        title="Billing & Statements"
        subtitle="Monthly statements per unit — one statement, many beneficiaries"
        quickActionLabel="Report Payment"
        onQuickAction={() =>
          setPayModalFor(invoices.find((i) => i.status !== 'PAID') ?? invoices[0] ?? null)
        }
      />

      <div className="space-y-8 p-8">
        {/* ── Tabs ── */}
        <div className="flex items-center gap-0.5 rounded-full border border-[#e8e8ea] bg-[#fafafa] p-1 w-fit">
          {(
            [
              ['STATEMENTS', 'Unit Statements'],
              ['CASH_VERIFICATION', 'Payment Verification'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              onClick={() => setActiveTab(value)}
              className={`rounded-full px-4 py-1.5 text-xs transition-colors ${
                activeTab === value
                  ? 'bg-[#111114] text-white'
                  : 'text-[#6e6e73] hover:text-[#111114]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {error && (
          <div className="rounded-[10px] border border-[#e8e8ea] bg-[#fafafa] p-4 text-xs text-[#111114]">
            Could not load billing data. <span className="text-[#6e6e73]">{error}</span>
          </div>
        )}

        {activeTab === 'STATEMENTS' ? (
          <>
            {!loading && invoices.length > 0 && (
              <div className="grid grid-cols-3 gap-6">
                <div className="hairline-card">
                  <p className="eyebrow-label">Total billed</p>
                  <p className="mt-1 text-xl font-semibold tracking-tight">
                    {money(invoices.reduce((s, i) => s + i.totalAmount, 0))}
                  </p>
                </div>
                <div className="hairline-card">
                  <p className="eyebrow-label">Collected</p>
                  <p className="mt-1 text-xl font-semibold tracking-tight">{money(collected)}</p>
                </div>
                <div className="hairline-card">
                  <p className="eyebrow-label">Outstanding</p>
                  <p className="mt-1 text-xl font-semibold tracking-tight">{money(outstanding)}</p>
                </div>
              </div>
            )}

            {loading ? (
              <div className="space-y-2">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-12 animate-pulse rounded-[10px] bg-[#fafafa]" />
                ))}
              </div>
            ) : invoices.length === 0 ? (
              <div className="rounded-[10px] border border-[#e8e8ea] p-10 text-center">
                <p className="text-sm text-[#111114]">No invoices yet.</p>
                <p className="mt-1 text-xs text-[#6e6e73]">
                  Generate a monthly statement from any unit's billing account.
                </p>
              </div>
            ) : (
              <div className="hairline-card overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#e8e8ea]">
                      {['INVOICE', 'UNIT', 'PERIOD', 'LINES', 'TOTAL', 'PAID', 'DUE', 'STATUS', ''].map(
                        (h) => (
                          <th
                            key={h}
                            className="px-3 py-3 text-[11px] font-medium uppercase tracking-[0.12em] text-[#6e6e73]"
                          >
                            {h}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e8e8ea]">
                    {invoices.map((inv) => (
                      <tr key={inv.id}>
                        <td className="px-3 py-3 font-mono text-[11px] font-semibold text-[#111114]">
                          {inv.invoiceNumber}
                        </td>
                        <td className="px-3 py-3">
                          {inv.billingAccount?.unit?.property?.name} ·{' '}
                          {inv.billingAccount?.unit?.name}
                        </td>
                        <td className="px-3 py-3 text-[#6e6e73]">{inv.periodKey ?? '—'}</td>
                        <td className="px-3 py-3 text-[#6e6e73]">{inv.lines?.length ?? 0}</td>
                        <td className="px-3 py-3 font-semibold">{money(inv.totalAmount)}</td>
                        <td className="px-3 py-3">{money(inv.paidAmount)}</td>
                        <td className="px-3 py-3 text-[#6e6e73]">
                          {new Date(inv.dueDate).toLocaleDateString('en-GB')}
                        </td>
                        <td className="px-3 py-3">{statusPill(inv.status)}</td>
                        <td className="px-3 py-3 text-right">
                          {inv.status !== 'PAID' && (
                            <button
                              onClick={() => setPayModalFor(inv)}
                              className="text-[11px] font-medium text-[#6e6e73] underline hover:text-[#111114]"
                            >
                              Report payment
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : (
          /* Payment verification happens per payment after reports arrive */
          <div className="rounded-[10px] border border-[#e8e8ea] p-10 text-center">
            <p className="text-sm text-[#111114]">Nothing awaiting verification.</p>
            <p className="mt-1 text-xs text-[#6e6e73]">
              Renter-reported payments appear here once they are recorded against an invoice.
            </p>
          </div>
        )}
      </div>

      {payModalFor && (
        <RecordPaymentModal
          invoice={payModalFor}
          onClose={() => setPayModalFor(null)}
          onDone={() => {
            setPayModalFor(null);
            void load();
          }}
        />
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────

const METHODS = ['BKASH', 'NAGAD', 'BANK', 'CASH', 'CHEQUE'];

function RecordPaymentModal({
  invoice,
  onClose,
  onDone,
}: {
  invoice: Invoice;
  onClose: () => void;
  onDone: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const outstanding = invoice.totalAmount - invoice.paidAmount;

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const amount = Number(f.get('amount'));
    if (!amount || amount <= 0) {
      setFormError('Enter the paid amount');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      await recordPayment({
        invoiceId: invoice.id,
        method: String(f.get('method')),
        amount,
        reference: String(f.get('reference')) || undefined,
        proofUrl: String(f.get('proofUrl')) || undefined,
      });
      onDone();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not record payment');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md space-y-5 rounded-[10px] border border-[#e8e8ea] bg-white p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-[#111114]">Report a payment</h3>
            <p className="font-mono text-[11px] text-[#6e6e73]">
              {invoice.invoiceNumber} · outstanding {money(outstanding)}
            </p>
          </div>
          <button onClick={onClose} className="text-[#6e6e73] hover:text-[#111114]">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form className="space-y-4 text-xs" onSubmit={submit}>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="eyebrow-label mb-1 block">Method</label>
              <select
                name="method"
                defaultValue="BKASH"
                className="w-full rounded-[10px] border border-[#e8e8ea] bg-[#fafafa] p-2.5 text-[#111114]"
              >
                {METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="eyebrow-label mb-1 block">Amount (৳)</label>
              <input
                name="amount"
                inputMode="numeric"
                required
                defaultValue={String(outstanding)}
                className="w-full rounded-[10px] border border-[#e8e8ea] bg-[#fafafa] p-2.5 text-[#111114]"
              />
            </div>
          </div>

          <div>
            <label className="eyebrow-label mb-1 block">Transaction reference</label>
            <input
              name="reference"
              placeholder="bKash TxnID / bank ref"
              className="w-full rounded-[10px] border border-[#e8e8ea] bg-[#fafafa] p-2.5 font-mono text-[#111114]"
            />
          </div>

          <div>
            <label className="eyebrow-label mb-1 block">Proof URL (optional)</label>
            <input
              name="proofUrl"
              placeholder="https://…"
              className="w-full rounded-[10px] border border-[#e8e8ea] bg-[#fafafa] p-2.5 text-[#111114]"
            />
            <p className="mt-1 text-[11px] leading-relaxed text-[#6e6e73]">
              Payments enter the verification queue — nothing is marked paid until staff verify.
            </p>
          </div>

          {formError && <p className="text-[11px] text-rose-700">{formError}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-pill-secondary py-2 px-4 text-xs">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn-pill-primary py-2 px-4 text-xs disabled:opacity-50"
            >
              {saving ? 'Reporting…' : 'Submit for verification'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
