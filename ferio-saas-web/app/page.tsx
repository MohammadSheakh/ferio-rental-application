'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Header } from '@/components/Header';
import { getActiveTenantSlug, listInvoices, listLeases, listMaintenance, listUnits, type Invoice } from '@/lib/api';

type Dashboard = { units: number; occupied: number; leases: number; openMaintenance: number; invoiced: number; invoices: Invoice[] };
const money = (value: number) => `৳ ${value.toLocaleString('en-US')}`;

export default function OverviewPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([listUnits(), listInvoices(), listLeases(), listMaintenance()])
      .then(([units, invoices, leases, maintenance]) => setData({
        units: units.length,
        occupied: units.filter((unit) => unit.status === 'OCCUPIED').length,
        leases: leases.filter((lease) => lease.status === 'ACTIVE').length,
        openMaintenance: maintenance.filter((item) => !['RESOLVED', 'CLOSED'].includes(item.status)).length,
        invoiced: invoices.reduce((sum, invoice) => sum + invoice.totalAmount, 0),
        invoices: invoices.slice(0, 6),
      }))
      .catch((cause) => setError(cause instanceof Error ? cause.message : 'Could not load workspace data'));
  }, []);

  return <div>
    <Header title="Portfolio overview" subtitle={`Live workspace data · ${getActiveTenantSlug()}`} />
    <div className="space-y-8 p-5 sm:p-8">
      {error && <p className="rounded-[10px] border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</p>}
      {!data && !error && <p className="text-sm text-[#6e6e73]">Loading workspace data…</p>}
      {data && <>
        <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ['Occupancy', data.units ? `${Math.round((data.occupied / data.units) * 100)}%` : '0%', `${data.occupied} of ${data.units} units`],
            ['Total invoiced', money(data.invoiced), 'Across current invoice records'],
            ['Active leases', String(data.leases), 'Current contracts'],
            ['Open maintenance', String(data.openMaintenance), 'Requests requiring attention'],
          ].map(([label, value, detail]) => <div key={label} className="hairline-card space-y-2"><span className="eyebrow-label">{label}</span><div className="text-2xl font-semibold tracking-tight">{value}</div><p className="text-xs text-[#6e6e73]">{detail}</p></div>)}
        </section>
        <section className="hairline-card space-y-4">
          <div className="flex items-center justify-between"><div><h2 className="text-sm font-semibold">Recent invoices</h2><p className="text-xs text-[#6e6e73]">Current tenant-database records</p></div><Link href="/billing" className="btn-pill-secondary px-4 py-2 text-xs">View billing</Link></div>
          {data.invoices.length === 0 ? <p className="border-t border-[#e8e8ea] py-8 text-sm text-[#6e6e73]">No invoices have been created.</p> : <div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead className="border-b border-[#e8e8ea] text-[11px] uppercase tracking-[0.12em] text-[#6e6e73]"><tr><th className="px-3 py-2">Invoice</th><th className="px-3 py-2">Unit</th><th className="px-3 py-2">Amount</th><th className="px-3 py-2">Status</th></tr></thead><tbody className="divide-y divide-[#e8e8ea]">{data.invoices.map((invoice) => <tr key={invoice.id}><td className="px-3 py-3 font-mono">{invoice.invoiceNumber}</td><td className="px-3 py-3">{invoice.billingAccount?.unit?.name ?? '—'}</td><td className="px-3 py-3 font-medium">{money(invoice.totalAmount)}</td><td className="px-3 py-3">{invoice.status}</td></tr>)}</tbody></table></div>}
        </section>
      </>}
    </div>
  </div>;
}
