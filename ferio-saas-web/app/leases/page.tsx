'use client';

import { useEffect, useState } from 'react';
import { Header } from '@/components/Header';
import { listLeases, type Lease } from '@/lib/api';

const money = (value: number) => `৳ ${value.toLocaleString('en-US')}`;
const date = (value: string) => new Date(value).toLocaleDateString('en-GB');

export default function LeasesPage() {
  const [leases, setLeases] = useState<Lease[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => { listLeases().then(setLeases).catch((cause) => setError(cause.message)).finally(() => setLoading(false)); }, []);
  const active = leases.filter((lease) => lease.status === 'ACTIVE');

  return <div>
    <Header title="Lease agreements" subtitle="Live contracts and occupancy state" />
    <div className="space-y-8 p-5 sm:p-8">
      <section className="grid gap-5 sm:grid-cols-3">
        <div className="hairline-card"><span className="eyebrow-label">Active contracts</span><div className="mt-2 text-2xl font-semibold">{active.length}</div></div>
        <div className="hairline-card"><span className="eyebrow-label">Deposits recorded</span><div className="mt-2 text-2xl font-semibold">{money(active.reduce((sum, lease) => sum + lease.securityDeposit, 0))}</div></div>
        <div className="hairline-card"><span className="eyebrow-label">All contracts</span><div className="mt-2 text-2xl font-semibold">{leases.length}</div></div>
      </section>
      <section className="hairline-card overflow-x-auto">
        {loading && <p className="text-sm text-[#6e6e73]">Loading leases…</p>}
        {error && <p className="text-sm text-rose-700">{error}</p>}
        {!loading && !error && leases.length === 0 && <p className="py-8 text-sm text-[#6e6e73]">No leases have been created.</p>}
        {leases.length > 0 && <table className="w-full text-left text-xs"><thead className="border-b border-[#e8e8ea] text-[11px] uppercase tracking-[0.12em] text-[#6e6e73]"><tr><th className="px-3 py-2">Lease</th><th className="px-3 py-2">Unit</th><th className="px-3 py-2">Renter</th><th className="px-3 py-2">Rent</th><th className="px-3 py-2">Term</th><th className="px-3 py-2">Status</th></tr></thead><tbody className="divide-y divide-[#e8e8ea]">{leases.map((lease) => <tr key={lease.id}><td className="px-3 py-3 font-mono">{lease.leaseNumber}</td><td className="px-3 py-3"><strong>{lease.unit.name}</strong><div className="text-[#6e6e73]">{lease.unit.property.name}</div></td><td className="px-3 py-3">{lease.renter.name}<div className="text-[#6e6e73]">{lease.renter.phone ?? '—'}</div></td><td className="px-3 py-3 font-medium">{money(lease.monthlyRent)}</td><td className="px-3 py-3 text-[#6e6e73]">{date(lease.startDate)} – {date(lease.endDate)}</td><td className="px-3 py-3">{lease.status}</td></tr>)}</tbody></table>}
      </section>
    </div>
  </div>;
}
