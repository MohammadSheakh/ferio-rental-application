'use client';

import { useEffect, useState } from 'react';
import { Header } from '@/components/Header';
import { listCrmLeads, type CrmLead } from '@/lib/api';

export default function CrmPage() {
  const [leads, setLeads] = useState<CrmLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => { listCrmLeads().then(setLeads).catch((cause) => setError(cause.message)).finally(() => setLoading(false)); }, []);

  return <div>
    <Header title="Broker CRM" subtitle="Live inquiry attribution and leasing pipeline" />
    <div className="space-y-8 p-5 sm:p-8">
      <section className="grid gap-5 sm:grid-cols-3"><div className="hairline-card"><span className="eyebrow-label">All leads</span><div className="mt-2 text-2xl font-semibold">{leads.length}</div></div><div className="hairline-card"><span className="eyebrow-label">New</span><div className="mt-2 text-2xl font-semibold">{leads.filter((lead) => lead.status === 'NEW').length}</div></div><div className="hairline-card"><span className="eyebrow-label">Converted</span><div className="mt-2 text-2xl font-semibold">{leads.filter((lead) => lead.status === 'CONVERTED').length}</div></div></section>
      <section className="hairline-card overflow-x-auto">{loading && <p className="text-sm text-[#6e6e73]">Loading leads…</p>}{error && <p className="text-sm text-rose-700">{error}</p>}{!loading && !error && leads.length === 0 && <p className="py-8 text-sm text-[#6e6e73]">No CRM leads have been recorded.</p>}{leads.length > 0 && <table className="w-full text-left text-xs"><thead className="border-b border-[#e8e8ea] text-[11px] uppercase tracking-[0.12em] text-[#6e6e73]"><tr><th className="px-3 py-2">Lead</th><th className="px-3 py-2">Contact</th><th className="px-3 py-2">Source</th><th className="px-3 py-2">Assigned to</th><th className="px-3 py-2">Status</th></tr></thead><tbody className="divide-y divide-[#e8e8ea]">{leads.map((lead) => <tr key={lead.id}><td className="px-3 py-3 font-medium">{lead.name}</td><td className="px-3 py-3">{lead.phone ?? lead.email ?? '—'}</td><td className="px-3 py-3">{lead.source}</td><td className="px-3 py-3">{lead.assignedTo ?? 'Unassigned'}</td><td className="px-3 py-3">{lead.status}</td></tr>)}</tbody></table>}</section>
    </div>
  </div>;
}
