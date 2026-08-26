'use client';

import { useEffect, useState } from 'react';
import { Header } from '@/components/Header';
import { listMaintenance, type MaintenanceRequest } from '@/lib/api';

export default function MaintenancePage() {
  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => { listMaintenance().then(setRequests).catch((cause) => setError(cause.message)).finally(() => setLoading(false)); }, []);
  const open = requests.filter((item) => !['RESOLVED', 'CLOSED'].includes(item.status));
  const activeOrders = requests.flatMap((item) => item.workOrders).filter((order) => !['COMPLETED', 'CANCELLED'].includes(order.status));

  return <div>
    <Header title="Maintenance operations" subtitle="Live requests and vendor work orders" />
    <div className="space-y-8 p-5 sm:p-8">
      <section className="grid gap-5 sm:grid-cols-3">
        <div className="hairline-card"><span className="eyebrow-label">Open requests</span><div className="mt-2 text-2xl font-semibold">{open.length}</div></div>
        <div className="hairline-card"><span className="eyebrow-label">High urgency</span><div className="mt-2 text-2xl font-semibold">{open.filter((item) => ['HIGH', 'EMERGENCY'].includes(item.urgency)).length}</div></div>
        <div className="hairline-card"><span className="eyebrow-label">Active work orders</span><div className="mt-2 text-2xl font-semibold">{activeOrders.length}</div></div>
      </section>
      <section className="hairline-card space-y-4">
        <div><h2 className="text-sm font-semibold">Request queue</h2><p className="text-xs text-[#6e6e73]">Newest requests first</p></div>
        {loading && <p className="text-sm text-[#6e6e73]">Loading maintenance requests…</p>}
        {error && <p className="text-sm text-rose-700">{error}</p>}
        {!loading && !error && requests.length === 0 && <p className="border-t border-[#e8e8ea] py-8 text-sm text-[#6e6e73]">No maintenance requests are open.</p>}
        <div className="divide-y divide-[#e8e8ea]">{requests.map((request) => <article key={request.id} className="grid gap-3 py-4 sm:grid-cols-[1fr_auto]"><div><div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-semibold">{request.title}</h3><span className="status-pill status-pill-neutral">{request.status}</span>{['HIGH', 'EMERGENCY'].includes(request.urgency) && <span className="status-pill status-pill-error">{request.urgency}</span>}</div><p className="mt-1 text-xs text-[#6e6e73]">{request.unit.property.name} · {request.unit.name} · {request.category}</p>{request.description && <p className="mt-3 text-sm">{request.description}</p>}</div><div className="text-right text-xs text-[#6e6e73]">{new Date(request.createdAt).toLocaleDateString('en-GB')}<div>{request.workOrders.length} work order(s)</div></div></article>)}</div>
      </section>
    </div>
  </div>;
}
