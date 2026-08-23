'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  BedDouble,
  CalendarDays,
  Wrench,
  Zap,
  X,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import {
  getMyRental,
  getRenterInvoices,
  getRenterUtilities,
  getRenterMaintenance,
  getRenterNotices,
  getRenterDocuments,
  reportRenterPayment,
  createRenterTicket,
  type MyTenancy,
  type RenterInvoice,
  type RenterUtilityAccount,
  type RenterTicket,
  type RenterNotice,
  type RenterDocument,
} from '@/lib/api';

function money(n: number) {
  return `৳ ${n.toLocaleString('en-US')}`;
}

function StatusPill({ status }: { status: string }) {
  const s = status.toLowerCase();
  if (['paid', 'active', 'resolved', 'confirmed', 'closed'].includes(s))
    return <span className="status-pill status-pill-success">{status.replaceAll('_', ' ')}</span>;
  if (['overdue', 'rejected', 'emergency'].includes(s))
    return <span className="status-pill status-pill-error">{status.replaceAll('_', ' ')}</span>;
  if (['issued', 'partially_paid', 'pending', 'reported', 'open'].includes(s))
    return <span className="status-pill status-pill-warning">{status.replaceAll('_', ' ')}</span>;
  return <span className="status-pill status-pill-neutral">{status.replaceAll('_', ' ')}</span>;
}

export default function RenterPortalPage() {
  const auth = useAuth();

  const [tenancy, setTenancy] = useState<MyTenancy | null>(null);
  const [invoices, setInvoices] = useState<RenterInvoice[]>([]);
  const [utilities, setUtilities] = useState<RenterUtilityAccount[]>([]);
  const [tickets, setTickets] = useState<RenterTicket[]>([]);
  const [notices, setNotices] = useState<RenterNotice[]>([]);
  const [documents, setDocuments] = useState<RenterDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [noTenancy, setNoTenancy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [payFor, setPayFor] = useState<RenterInvoice | null>(null);
  const [ticketFormOpen, setTicketFormOpen] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const me = await getMyRental();
      setTenancy(me);
      const [inv, util, maint, nts, docs] = await Promise.all([
        getRenterInvoices(),
        getRenterUtilities().catch(() => []),
        getRenterMaintenance().catch(() => []),
        getRenterNotices().catch(() => []),
        getRenterDocuments().catch(() => []),
      ]);
      setInvoices(inv);
      setUtilities(util);
      setTickets(maint);
      setNotices(nts);
      setDocuments(docs);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      if (/not found/i.test(msg) || /tenancy/i.test(msg)) setNoTenancy(true);
      else setError(msg || 'Could not load your rental');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (auth.ready && !auth.token) return; // rendered by gate below
    if (auth.ready && auth.token) void loadAll();
  }, [auth.ready, auth.token, loadAll]);

  // ── Gates ──
  if (!auth.ready) return <div className="min-h-screen bg-white" />;
  if (!auth.token) {
    return (
      <div className="mx-auto max-w-md px-6 py-24 text-center">
        <p className="text-sm text-[#111114]">Sign in to view your rental.</p>
        <Link href="/login" className="btn-pill-primary mt-6 inline-flex text-xs">
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-[#111114]">
      <header className="border-b border-[#e8e8ea]">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#111114] text-sm font-bold text-white">F</div>
            <span className="text-base font-semibold tracking-tight">Ferio</span>
            <span className="text-[10px] uppercase tracking-[0.12em] text-[#6e6e73]">My Rental</span>
          </Link>
          <Link href="/" className="flex items-center gap-1.5 text-xs text-[#6e6e73] hover:text-[#111114]">
            <ArrowLeft className="h-3.5 w-3.5" /> Marketplace
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-12 px-6 py-12">
        {loading ? (
          <>
            <div className="h-28 animate-pulse rounded-[10px] bg-[#fafafa]" />
            <div className="h-40 animate-pulse rounded-[10px] bg-[#fafafa]" />
          </>
        ) : error ? (
          <div className="rounded-[10px] border border-[#e8e8ea] p-8 text-center text-xs text-[#111114]">
            Could not load your rental. <span className="text-[#6e6e73]">{error}</span>
          </div>
        ) : noTenancy || !tenancy ? (
          <div className="rounded-[10px] border border-[#e8e8ea] p-12 text-center">
            <p className="text-sm">You don't have an active rental yet.</p>
            <p className="mt-1 text-xs text-[#6e6e73]">
              Once a landlord confirms your tenancy in Ferio, it appears here.
            </p>
            <Link href="/" className="btn-pill-secondary mt-6 inline-flex text-xs">
              Browse properties
            </Link>
          </div>
        ) : (
          <>
            {/* ── Tenancy header ── */}
            <section className="space-y-4">
              <p className="eyebrow-label">{tenancy.organization.name}</p>
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                    {tenancy.unit.property} — Unit {tenancy.unit.name}
                  </h1>
                  <p className="mt-1 flex flex-wrap items-center gap-3 text-xs text-[#6e6e73]">
                    <span className="flex items-center gap-1">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {new Date(tenancy.lease.startDate).toLocaleDateString('en-GB')} –{' '}
                      {new Date(tenancy.lease.endDate).toLocaleDateString('en-GB')}
                    </span>
                    <StatusPill status={tenancy.lease.status} />
                  </p>
                </div>
                <div className="text-right">
                  <p className="eyebrow-label">Monthly rent</p>
                  <p className="text-xl font-semibold tracking-tight">
                    {money(tenancy.lease.monthlyRent)}
                  </p>
                  <p className="mt-1 text-xs">
                    Outstanding{' '}
                    <strong
                      className={
                        tenancy.outstandingBdt > 0 ? 'text-rose-700' : 'text-emerald-700'
                      }
                    >
                      {money(tenancy.outstandingBdt)}
                    </strong>
                  </p>
                </div>
              </div>
            </section>

            {/* ── Pay your beneficiaries ── */}
            <section className="space-y-4">
              <h2 className="eyebrow-label">How to pay</h2>
              <p className="text-xs leading-relaxed text-[#6e6e73]">
                Pay each beneficiary directly, then report the payment below so it is
                recorded against your statement.
              </p>
              <ul className="divide-y divide-[#e8e8ea] overflow-hidden rounded-[10px] border border-[#e8e8ea]">
                {tenancy.beneficiaries.map((b, i) => (
                  <li key={i} className="flex flex-wrap items-center gap-x-6 gap-y-2 px-5 py-4 text-xs">
                    <span className="font-semibold text-[#111114]">
                      {b.owner} · {b.sharePercent}%
                    </span>
                    {b.method === 'BKASH' && b.bkashNumber && (
                      <span>bKash <strong className="font-mono">{b.bkashNumber}</strong></span>
                    )}
                    {b.method === 'NAGAD' && b.nagadNumber && (
                      <span>Nagad <strong className="font-mono">{b.nagadNumber}</strong></span>
                    )}
                    {b.bank && <span>Bank <strong>{b.bank}</strong></span>}
                    {!b.bkashNumber && !b.nagadNumber && !b.bank && (
                      <span className="text-[#6e6e73]">Ask management for payment details</span>
                    )}
                    {b.instructions && (
                      <span className="w-full text-[11px] text-[#6e6e73]">{b.instructions}</span>
                    )}
                  </li>
                ))}
              </ul>
            </section>

            {/* ── Statements ── */}
            <section className="space-y-4">
              <h2 className="eyebrow-label">Statements</h2>
              {invoices.length === 0 ? (
                <p className="rounded-[10px] border border-[#e8e8ea] p-6 text-center text-xs text-[#6e6e73]">
                  No statements yet.
                </p>
              ) : (
                <div className="overflow-x-auto rounded-[10px] border border-[#e8e8ea]">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-[#e8e8ea]">
                        {['PERIOD', 'TOTAL', 'PAID', 'DUE', 'RECEIPTS', 'STATUS', ''].map((h) => (
                          <th key={h} className="px-4 py-3 text-[11px] font-medium uppercase tracking-[0.12em] text-[#6e6e73]">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#e8e8ea]">
                      {invoices.map((inv) => {
                        const receipts = inv.payments.filter((p) => p.receiptNumber);
                        return (
                          <tr key={inv.id}>
                            <td className="px-4 py-3 font-mono text-[11px]">{inv.periodKey ?? '—'}</td>
                            <td className="px-4 py-3">{money(inv.totalAmount)}</td>
                            <td className="px-4 py-3">{money(inv.paidAmount)}</td>
                            <td className="px-4 py-3 text-[#6e6e73]">
                              {new Date(inv.dueDate).toLocaleDateString('en-GB')}
                            </td>
                            <td className="px-4 py-3">
                              {receipts.length ? (
                                <span className="font-mono text-[11px]">
                                  {receipts.map((r) => r.receiptNumber).join(', ')}
                                </span>
                              ) : (
                                <span className="text-[#6e6e73]">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3"><StatusPill status={inv.status} /></td>
                            <td className="px-4 py-3 text-right">
                              {inv.totalAmount > inv.paidAmount && (
                                <button
                                  onClick={() => setPayFor(inv)}
                                  className="text-[11px] font-medium underline hover:text-[#111114] text-[#6e6e73]"
                                >
                                  Report payment
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* ── Maintenance ── */}
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="eyebrow-label flex items-center gap-2">
                  <Wrench className="h-3.5 w-3.5" /> Maintenance
                </h2>
                <button onClick={() => setTicketFormOpen(true)} className="btn-pill-secondary py-1.5 px-3 text-xs">
                  Report an issue
                </button>
              </div>
              {tickets.length === 0 ? (
                <p className="rounded-[10px] border border-[#e8e8ea] p-6 text-center text-xs text-[#6e6e73]">
                  No maintenance requests for your unit.
                </p>
              ) : (
                <ul className="divide-y divide-[#e8e8ea] overflow-hidden rounded-[10px] border border-[#e8e8ea]">
                  {tickets.map((t) => (
                    <li key={t.id} className="space-y-1.5 px-5 py-4">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-medium">{t.title}</span>
                        <StatusPill status={t.status} />
                      </div>
                      {t.description && (
                        <p className="text-xs leading-relaxed text-[#6e6e73]">{t.description}</p>
                      )}
                      <p className="text-[11px] text-[#6e6e73]">
                        Opened {new Date(t.createdAt).toLocaleDateString('en-GB')}
                        {t.workOrders[0]?.assignedTo && ` · assigned to ${t.workOrders[0].assignedTo}`}
                        {t.actualCost != null && ` · cost ${money(t.actualCost)}`}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* ── Notices ── */}
            {notices.length > 0 && (
              <section className="space-y-4">
                <h2 className="eyebrow-label">Notices</h2>
                <ul className="divide-y divide-[#e8e8ea] overflow-hidden rounded-[10px] border border-[#e8e8ea]">
                  {notices.map((n) => (
                    <li key={n.id} className="space-y-1 px-5 py-4">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-medium">{n.title}</span>
                        <span className="text-[11px] text-[#6e6e73]">
                          {new Date(n.createdAt).toLocaleDateString('en-GB')}
                        </span>
                      </div>
                      {n.body && (
                        <p className="text-xs leading-relaxed text-[#6e6e73]">{n.body}</p>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* ── Documents ── */}
            {documents.length > 0 && (
              <section className="space-y-4">
                <h2 className="eyebrow-label">Documents</h2>
                <ul className="divide-y divide-[#e8e8ea] overflow-hidden rounded-[10px] border border-[#e8e8ea]">
                  {documents.map((doc) => (
                    <li key={doc.id} className="flex items-center gap-3 px-5 py-3.5 text-xs">
                      <span className="font-medium">{doc.name}</span>
                      <span className="ml-auto flex items-center gap-3">
                        <span className="text-[11px] uppercase tracking-[0.12em] text-[#6e6e73]">
                          {doc.category.toLowerCase()}
                        </span>
                        <a
                          href={doc.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="underline hover:text-[#111114] text-[#6e6e73]"
                        >
                          Open
                        </a>
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* ── Utilities ── */}
            {utilities.length > 0 && (
              <section className="space-y-4">
                <h2 className="eyebrow-label flex items-center gap-2">
                  <Zap className="h-3.5 w-3.5" /> Utilities & meters
                </h2>
                <ul className="divide-y divide-[#e8e8ea] overflow-hidden rounded-[10px] border border-[#e8e8ea]">
                  {utilities.map((u) => (
                    <li key={u.id} className="px-5 py-4">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium capitalize">
                          {u.type.toLowerCase()} {u.provider ? `· ${u.provider}` : ''}
                        </span>
                        {u.accountNumber && (
                          <span className="font-mono text-[11px] text-[#6e6e73]">{u.accountNumber}</span>
                        )}
                      </div>
                      {u.meters[0]?.readings[0] && (
                        <p className="mt-1 text-[11px] text-[#6e6e73]">
                          Latest reading{' '}
                          <strong className="text-[#111114]">
                            {u.meters[0].readings[0].currentReading}
                          </strong>{' '}
                          (+{u.meters[0].readings[0].consumption}) ·{' '}
                          {new Date(u.meters[0].readings[0].readingDate).toLocaleDateString('en-GB')}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </main>

      {/* ── Report payment modal ── */}
      {payFor && (
        <PaymentModal
          invoice={payFor}
          onClose={() => setPayFor(null)}
          onDone={() => {
            setPayFor(null);
            void loadAll();
          }}
        />
      )}

      {/* ── New maintenance ticket modal ── */}
      {ticketFormOpen && (
        <TicketModal
          onClose={() => setTicketFormOpen(false)}
          onDone={() => {
            setTicketFormOpen(false);
            void loadAll();
          }}
        />
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────

const METHODS = ['BKASH', 'NAGAD', 'BANK', 'CASH'];

function PaymentModal({
  invoice,
  onClose,
  onDone,
}: {
  invoice: RenterInvoice;
  onClose: () => void;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    try {
      await reportRenterPayment({
        invoiceId: invoice.id,
        method: String(f.get('method')),
        amount: Number(f.get('amount')),
        reference: String(f.get('reference')) || undefined,
      });
      onDone();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : 'Could not submit');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md space-y-5 rounded-[10px] border border-[#e8e8ea] bg-white p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold">Report a payment</h3>
            <p className="font-mono text-[11px] text-[#6e6e73]">
              {invoice.invoiceNumber} · outstanding {money(invoice.totalAmount - invoice.paidAmount)}
            </p>
          </div>
          <button onClick={onClose} className="text-[#6e6e73] hover:text-[#111114]"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={submit} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="eyebrow-label mb-1 block">Method</label>
              <select name="method" defaultValue="BKASH" className="w-full rounded-[10px] border border-[#e8e8ea] bg-[#fafafa] p-2.5">
                {METHODS.map((m) => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="eyebrow-label mb-1 block">Amount (৳)</label>
              <input name="amount" required inputMode="numeric" defaultValue={String(invoice.totalAmount - invoice.paidAmount)} className="w-full rounded-[10px] border border-[#e8e8ea] bg-[#fafafa] p-2.5" />
            </div>
          </div>
          <div>
            <label className="eyebrow-label mb-1 block">Transaction reference</label>
            <input name="reference" placeholder="bKash TxnID…" className="w-full rounded-[10px] border border-[#e8e8ea] bg-[#fafafa] p-2.5 font-mono" />
          </div>
          {err && <p className="text-[11px] text-rose-700">{err}</p>}
          <p className="text-[11px] leading-relaxed text-[#6e6e73]">
            Your payment is verified by the management team before it reduces your balance.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-pill-secondary py-2 px-4 text-xs">Cancel</button>
            <button type="submit" disabled={busy} className="btn-pill-primary py-2 px-4 text-xs disabled:opacity-50">
              {busy ? 'Submitting…' : 'Submit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function TicketModal({
  onClose,
  onDone,
}: {
  onClose: () => void;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    try {
      await createRenterTicket({
        title: String(f.get('title')),
        description: String(f.get('description')) || undefined,
        urgency: (String(f.get('urgency')) || 'NORMAL') as 'NORMAL',
      });
      onDone();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : 'Could not submit');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md space-y-5 rounded-[10px] border border-[#e8e8ea] bg-white p-6">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold">Report an issue</h3>
          <button onClick={onClose} className="text-[#6e6e73] hover:text-[#111114]"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={submit} className="space-y-4 text-xs">
          <div>
            <label className="eyebrow-label mb-1 block">What's wrong?</label>
            <input name="title" required placeholder="e.g. Kitchen tap leaking" className="w-full rounded-[10px] border border-[#e8e8ea] bg-[#fafafa] p-2.5" />
          </div>
          <div>
            <label className="eyebrow-label mb-1 block">Urgency</label>
            <select name="urgency" defaultValue="NORMAL" className="w-full rounded-[10px] border border-[#e8e8ea] bg-[#fafafa] p-2.5 capitalize">
              {['LOW', 'NORMAL', 'URGENT', 'EMERGENCY'].map((u) => <option key={u}>{u.toLowerCase()}</option>)}
            </select>
          </div>
          <div>
            <label className="eyebrow-label mb-1 block">Details</label>
            <textarea name="description" rows={3} className="w-full rounded-[10px] border border-[#e8e8ea] bg-[#fafafa] p-2.5" />
          </div>
          {err && <p className="text-[11px] text-rose-700">{err}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-pill-secondary py-2 px-4 text-xs">Cancel</button>
            <button type="submit" disabled={busy} className="btn-pill-primary py-2 px-4 text-xs disabled:opacity-50">
              {busy ? 'Sending…' : 'Send request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
