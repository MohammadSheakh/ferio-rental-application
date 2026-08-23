'use client';

import { Header } from '@/components/Header';
import { Building2, FileText, CreditCard, ArrowUpRight, TrendingUp, AlertCircle, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

export default function OverviewPage() {
  const kpiStats = [
    { label: 'Occupancy Rate', value: '94.2%', change: '+2.1%', isPositive: true, sub: '48 of 51 Units Occupied' },
    { label: 'Monthly Revenue', value: '৳ 2,145,000', change: '+৳ 120k', isPositive: true, sub: 'August 2026 Invoiced' },
    { label: 'Active Leases', value: '48', change: '2 Renewal Pending', isPositive: false, sub: 'Avg Duration 12 Mo' },
    { label: 'Maintenance Queue', value: '3 Open', change: '1 Emergency', isPositive: false, sub: 'Avg Resolve Time 4h' },
  ];

  const recentInvoices = [
    { id: 'INV-2026-08-012', tenant: 'Tanvir Hossain', unit: 'Rose Valley #A-4', amount: '৳ 45,000', dueDate: '05 Aug 2026', status: 'PAID', method: 'bKash' },
    { id: 'INV-2026-08-013', tenant: 'Sultana Parveen', unit: 'Banani Tower #B-2', amount: '৳ 62,000', dueDate: '05 Aug 2026', status: 'PAID', method: 'Bank Transfer' },
    { id: 'INV-2026-08-014', tenant: 'Mahmudur Rahman', unit: 'Gulshan Heights #4-C', amount: '৳ 85,000', dueDate: '10 Aug 2026', status: 'OVERDUE', method: 'Cash (Pending)' },
    { id: 'INV-2026-08-015', tenant: 'Kamrul Hasan', unit: 'Rose Valley #B-1', amount: '৳ 48,000', dueDate: '05 Aug 2026', status: 'PARTIALLY_PAID', method: 'Nagad' },
  ];

  return (
    <div>
      <Header
        title="Portfolio Operations Overview"
        subtitle="Dhaka Prime Properties — Organization ID: DHAKA-PRIME"
        quickActionLabel="New Property"
      />

      <div className="p-8 space-y-8">
        {/* KPI Metrics Cards */}
        <div className="grid grid-cols-4 gap-5">
          {kpiStats.map((kpi) => (
            <div key={kpi.label} className="hairline-card space-y-3">
              <div className="flex items-center justify-between">
                <span className="eyebrow-label">{kpi.label}</span>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${kpi.isPositive ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                  {kpi.change}
                </span>
              </div>
              <div className="text-2xl font-bold text-[#111114] tracking-tight">{kpi.value}</div>
              <div className="text-xs text-[#6e6e73]">{kpi.sub}</div>
            </div>
          ))}
        </div>

        {/* Operational Split Grid */}
        <div className="grid grid-cols-3 gap-8">
          {/* Main Table: Recent Financial Transactions */}
          <div className="col-span-2 hairline-card space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-[#111114]">Recent Invoices & Cash Collections</h2>
                <p className="text-xs text-[#6e6e73]">Automated double-entry ledger postings</p>
              </div>
              <Link href="/billing" className="text-xs font-semibold text-[#111114] hover:underline flex items-center gap-1">
                View Ledger <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#e8e8ea] text-[11px] font-semibold text-[#6e6e73] uppercase tracking-wider">
                    <th className="py-2.5 px-3">Invoice #</th>
                    <th className="py-2.5 px-3">Tenant & Unit</th>
                    <th className="py-2.5 px-3">Amount</th>
                    <th className="py-2.5 px-3">Payment Method</th>
                    <th className="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e8e8ea] text-xs">
                  {recentInvoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-[#fafafa] transition-colors">
                      <td className="py-3 px-3 font-mono font-medium text-[#111114]">{inv.id}</td>
                      <td className="py-3 px-3">
                        <div className="font-medium text-[#111114]">{inv.tenant}</div>
                        <div className="text-[11px] text-[#6e6e73]">{inv.unit}</div>
                      </td>
                      <td className="py-3 px-3 font-semibold text-[#111114]">{inv.amount}</td>
                      <td className="py-3 px-3 text-[#6e6e73]">{inv.method}</td>
                      <td className="py-3 px-3">
                        {inv.status === 'PAID' && (
                          <span className="status-pill status-pill-success">PAID</span>
                        )}
                        {inv.status === 'OVERDUE' && (
                          <span className="status-pill status-pill-error">OVERDUE</span>
                        )}
                        {inv.status === 'PARTIALLY_PAID' && (
                          <span className="status-pill status-pill-warning">PARTIAL</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Side Panel: Unit Status & Quick Actions */}
          <div className="space-y-6">
            {/* Quick Actions Card */}
            <div className="hairline-card space-y-4">
              <span className="eyebrow-label">Action Shortcuts</span>
              <div className="space-y-2">
                <Link href="/billing" className="w-full btn-pill-secondary text-xs justify-between py-2 px-4">
                  <span>Record Cash / bKash Payment</span>
                  <CreditCard className="w-3.5 h-3.5 text-[#6e6e73]" />
                </Link>
                <Link href="/leases" className="w-full btn-pill-secondary text-xs justify-between py-2 px-4">
                  <span>Draft New Lease Agreement</span>
                  <FileText className="w-3.5 h-3.5 text-[#6e6e73]" />
                </Link>
                <Link href="/crm" className="w-full btn-pill-secondary text-xs justify-between py-2 px-4">
                  <span>Register Prospect Lead</span>
                  <Building2 className="w-3.5 h-3.5 text-[#6e6e73]" />
                </Link>
              </div>
            </div>

            {/* Emergency Maintenance Snippet */}
            <div className="hairline-card bg-rose-50/40 border-rose-200 space-y-3">
              <div className="flex items-center gap-2 text-rose-700 font-semibold text-xs">
                <AlertCircle className="w-4 h-4" />
                Emergency Maintenance Alert
              </div>
              <p className="text-xs text-[#111114]">
                Water Pipe Burst at <strong className="font-semibold">Rose Valley #A-2</strong>. Reported via WhatsApp by tenant Rafiqul Islam.
              </p>
              <div className="flex justify-end">
                <Link href="/maintenance" className="btn-pill-primary text-xs py-1 px-3">
                  Assign Vendor Work Order
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
