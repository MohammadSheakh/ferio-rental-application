'use client';

import { useEffect, useState } from 'react';
import { Header } from '@/components/Header';
import { listUtilities, type UtilityAccount } from '@/lib/api';

export default function UtilitiesPage() {
  const [accounts, setAccounts] = useState<UtilityAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => { listUtilities().then(setAccounts).catch((cause) => setError(cause.message)).finally(() => setLoading(false)); }, []);
  const totalBills = accounts.flatMap((account) => account.bills).reduce((sum, bill) => sum + bill.totalAmount, 0);

  return <div>
    <Header title="Utility accounts" subtitle="Live meters, readings, and recent bills" />
    <div className="space-y-8 p-5 sm:p-8">
      <section className="grid gap-5 sm:grid-cols-3"><div className="hairline-card"><span className="eyebrow-label">Accounts</span><div className="mt-2 text-2xl font-semibold">{accounts.length}</div></div><div className="hairline-card"><span className="eyebrow-label">Meters</span><div className="mt-2 text-2xl font-semibold">{accounts.flatMap((account) => account.meters).length}</div></div><div className="hairline-card"><span className="eyebrow-label">Recent bill total</span><div className="mt-2 text-2xl font-semibold">৳ {totalBills.toLocaleString('en-US')}</div></div></section>
      <section className="hairline-card space-y-4">{loading && <p className="text-sm text-[#6e6e73]">Loading utility accounts…</p>}{error && <p className="text-sm text-rose-700">{error}</p>}{!loading && !error && accounts.length === 0 && <p className="py-8 text-sm text-[#6e6e73]">No utility accounts have been configured.</p>}<div className="divide-y divide-[#e8e8ea]">{accounts.map((account) => <article key={account.id} className="grid gap-3 py-4 sm:grid-cols-[1fr_auto]"><div><h2 className="text-sm font-semibold">{account.provider ?? account.type}</h2><p className="text-xs text-[#6e6e73]">{account.type} · {account.scope} · {account.accountNumber ?? 'No account number'}</p></div><div className="text-right text-xs"><strong>{account.meters.length}</strong> meter(s)<div className="text-[#6e6e73]">{account.bills.length} recent bill(s)</div></div></article>)}</div></section>
    </div>
  </div>;
}
