'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Building2, Users, CalendarDays, Wrench } from 'lucide-react';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:6799/api/v1';
const STORAGE_KEY = 'ferio_identity';

interface OwnerCoOwner { ownerName: string; sharePercent: number }
interface OwnerLease {
  id: string; status: string; monthlyRent: number;
  startDate: string; endDate: string; renterName: string | null;
}
interface OwnerUnit {
  organization: { slug: string; name: string };
  unitId: string; unitName: string; propertyName: string | null;
  mySharePercent: number; coOwners: OwnerCoOwner[];
  lease: OwnerLease | null;
  expectedMonthlyRentBdt: number; outstandingBdt: number;
}
interface OwnerInvoice {
  id: string; invoiceNumber: string; periodKey: string | null;
  status: string; totalAmount: number; paidAmount: number; dueDate: string;
  payments: Array<{ receiptNumber: string | null }>;
  billingAccount?: { unit?: { name: string; property?: { name: string } } };
}
interface OwnerTicket {
  id: string; title: string; status: string; urgency: string;
  unitName: string; createdAt: string;
}

function money(n: number) {
  return `৳ ${n.toLocaleString('en-US')}`;
}

function Pill({ status }: { status: string }) {
  const s = status.toLowerCase();
  if (['active', 'paid', 'completed', 'resolved'].includes(s))
    return <span className="status-pill status-pill-success">{status.replaceAll('_', ' ')}</span>;
  if (['overdue', 'rejected', 'emergency', 'no_show'].includes(s))
    return <span className="status-pill status-pill-error">{status.replaceAll('_', ' ')}</span>;
  if (['pending', 'issued', 'partially_paid', 'scheduled'].includes(s))
    return <span className="status-pill status-pill-warning">{status.replaceAll('_', ' ')}</span>;
  return <span className="status-pill status-pill-neutral">{status.replaceAll('_', ' ')}</span>;
}

export default function OwnerPortalPage() {
  const [portfolio, setPortfolio] = useState<OwnerUnit[] | null>(null);
  const [totals, setTotals] = useState<{ expected: number; outstanding: number } | null>(null);
  const [tickets, setTickets] = useState<OwnerTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const raw = window.localStorage.getItem('ferio_identity');
      const token = raw ? (JSON.parse(raw) as { token: string }).token : null;

      const h = (t?: string | null) => ({
        'Content-Type': 'application/json',
        ...(t ? { Authorization: `Bearer ${t}` } : {}),
      });

      const [pRes, mRes] = await Promise.all([
        fetch(`${API_URL}/owner/me`, { headers: h(token), cache: 'no-store' }),
        fetch(`${API_URL}/owner/maintenance`, { headers: h(token), cache: 'no-store' }),
      ]);

      const pJson = await pRes.json().catch(() => ({}));
      if (!pRes.ok) throw new Error(pJson?.message ?? `Portfolio failed (${pRes.status})`);
      setPortfolio((pJson?.data ?? pJson).units ?? []);
      setTotals({
        expected: (pJson?.data?.totals?.expectedMonthlyRentBdt ?? 0),
        outstanding: (pJson?.data?.totals?.outstandingBdt ?? 0),
      });

      const mJson = await mRes.json().catch(() => ({}));
      setTickets(mRes.ok ? ((mJson?.data ?? mJson) as OwnerTicket[]) : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load portfolio');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="min-h-screen bg-white text-[#111114]">
      <header className="border-b border-[#e8e8ea]">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#111114] text-sm font-bold text-white">F</div>
            <span className="text-base font-semibold tracking-tight">Ferio</span>
            <span className="text-[10px] uppercase tracking-[0.12em] text-[#6e6e73]">Owner Portal</span>
          </Link>
          <Link href="/" className="text-xs text-[#6e6e73] hover:text-[#111114]">← Marketplace</Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-12 px-6 py-12">
        {/* ── Header ── */}
        <section className="space-y-3">
          <p className="eyebrow-label">Owner Portfolio</p>
          <h1 className="text-3xl font-semibold tracking-tight">Your units &amp; earnings</h1>
          <p className="max-w-xl text-sm leading-relaxed text-[#6e6e73]">
            Everything you co-own across Ferio organizations — your rent share,
            outstanding statements and open maintenance.
          </p>
        </section>

        {error && (
          <div className="rounded-[10px] border border-[#e8e8ea] bg-[#fafafa] p-4 text-xs">
            Could not load your portfolio. <span className="text-[#6e6e73]">{error}</span>
          </div>
        )}

        {loading ? (
          <div className="space-y-4">
            <div className="h-24 animate-pulse rounded-[10px] bg-[#fafafa]" />
            <div className="h-40 animate-pulse rounded-[10px] bg-[#fafafa]" />
          </div>
        ) : !portfolio || portfolio.length === 0 ? (
          <div className="rounded-[10px] border border-[#e8e8ea] p-12 text-center">
            <p className="text-sm">You don&apos;t own any registered units yet.</p>
            <p className="mt-1 text-xs text-[#6e6e73]">
              Once an organization lists you as a unit owner, it appears here.
            </p>
          </div>
        ) : (
          <>
            {/* ── Totals ── */}
            {totals && (
              <section className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div className="rounded-[10px] border border-[#e8e8ea] p-5">
                  <p className="eyebrow-label">Expected monthly rent</p>
                  <p className="mt-2 text-2xl font-semibold tracking-tight">{money(totals.expected)}</p>
                </div>
                <div className="rounded-[10px] border border-[#e8e8ea] p-5">
                  <p className="eyebrow-label">Total outstanding</p>
                  <p className="mt-2 text-2xl font-semibold tracking-tight">{money(totals.outstanding)}</p>
                </div>
              </section>
            )}

            {/* ── Units ── */}
            <section className="space-y-5">
              <h2 className="eyebrow-label">Owned units</h2>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {portfolio.map((u) => (
                  <article key={u.unitId} className="space-y-3 rounded-[10px] border border-[#e8e8ea] p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="eyebrow-label">{u.organization.name}</p>
                        <h3 className="mt-1 text-base font-semibold tracking-tight">
                          {u.propertyName ?? u.unitName}
                        </h3>
                        <p className="text-xs text-[#6e6e73]">Unit {u.unitName}</p>
                      </div>
                      <span className="rounded-full bg-[#111114] px-2.5 py-0.5 text-[11px] font-semibold text-white">
                        {u.mySharePercent}%
                      </span>
                    </div>

                    <dl className="divide-y divide-[#e8e8ea] text-xs">
                      <Row label="My share" value={`${money(u.expectedMonthlyRentBdt)} / mo`} />
                      <Row label="Outstanding" value={money(u.outstandingBdt)} />
                      {u.coOwners.length > 0 && (
                        <Row
                          label="Co-owners"
                          value={u.coOwners.map((c) => `${c.ownerName} ${c.sharePercent}%`).join(', ')}
                        />
                      )}
                    </dl>

                    {u.lease && (
                      <p className="flex items-center gap-1.5 text-[11px] text-[#6e6e73]">
                        <CalendarDays className="h-3 w-3" />
                        Lease till {new Date(u.lease.endDate).toLocaleDateString('en-GB')}
                        {u.lease.renterName ? ` · ${u.lease.renterName}` : ''}
                      </p>
                    )}
                  </article>
                ))}
              </div>
            </section>

            {/* ── Maintenance ── */}
            {tickets.length > 0 && (
              <section className="space-y-4">
                <h2 className="eyebrow-label flex items-center gap-2">
                  <Wrench className="h-3.5 w-3.5" /> Maintenance on your units
                </h2>
                <ul className="divide-y divide-[#e8e8ea] overflow-hidden rounded-[10px] border border-[#e8e8ea]">
                  {tickets.map((t) => (
                    <li key={t.id} className="flex items-center gap-3 px-5 py-4 text-xs">
                      <span className="font-medium">{t.title}</span>
                      <span className="ml-auto"><Pill status={t.status} /></span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </main>

      <footer className="border-t border-[#e8e8ea] py-6 text-center text-[11px] text-[#6e6e73]">
        Figures reflect verified payments only.
      </footer>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2">
      <dt className="text-[11px] uppercase tracking-[0.12em] text-[#6e6e73]" style={{ fontSize: 11 }}>
        {label}
      </dt>
      <dd className="text-[#111114]">{value}</dd>
    </div>
  );
}
