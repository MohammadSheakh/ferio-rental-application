'use client';

import { Header } from '@/components/Header';
import { Building, TrendingUp, DollarSign, Download, ArrowUpRight, ShieldCheck, CheckCircle2, FileText } from 'lucide-react';

export default function OwnerPortalPage() {
  const ownerProfile = {
    name: 'Engr. Shahabuddin Ahmed',
    type: 'INDIVIDUAL_OWNER',
    taxId: 'TIN-9876543210',
    bankAccount: 'Dutch-Bangla Bank (A/C: 104-***-8899)',
    managementFeeRate: '5.0%',
  };

  const ownerKpis = [
    { label: 'Gross Revenue (Aug)', value: '৳ 620,000', sub: 'From 5 Owned Units' },
    { label: 'Management Fee (5%)', value: '- ৳ 31,000', sub: 'Operator Service Charge' },
    { label: 'Approved Repairs', value: '- ৳ 8,500', sub: 'Unit #A-2 Pipe Repair' },
    { label: 'Net Monthly Payout', value: '৳ 580,500', sub: 'Disbursed to DBBL Account' },
  ];

  const ownedProperties = [
    {
      code: 'PROP-RVH',
      building: 'Rose Valley Heights',
      unit: 'Apt #A-1',
      occupancy: 'OCCUPIED',
      tenant: 'Tanvir Hossain',
      grossRent: '৳ 45,000',
      netPayout: '৳ 42,750',
    },
    {
      code: 'PROP-RVH',
      building: 'Rose Valley Heights',
      unit: 'Apt #A-2',
      occupancy: 'OCCUPIED',
      tenant: 'Sultana Parveen',
      grossRent: '৳ 55,000',
      netPayout: '৳ 43,750', // After 8.5k repair deduction
    },
    {
      code: 'PROP-GLS',
      building: 'Gulshan Garden Residency',
      unit: 'Suite #4-C',
      occupancy: 'OCCUPIED',
      tenant: 'Mahmudur Rahman',
      grossRent: '৳ 85,000',
      netPayout: '৳ 80,750',
    },
  ];

  const disbursementHistory = [
    { id: 'DISB-2026-08', period: 'August 2026', gross: '৳ 620,000', net: '৳ 580,500', status: 'DISBURSED', date: '10 Aug 2026' },
    { id: 'DISB-2026-07', period: 'July 2026', gross: '৳ 620,000', net: '৳ 589,000', status: 'DISBURSED', date: '10 Jul 2026' },
  ];

  return (
    <div>
      <Header
        title="Property Owner Yield & Disbursement Portal"
        subtitle={`Welcome, ${ownerProfile.name} — Investor Portfolio Account`}
      />

      <div className="p-8 space-y-8">
        {/* Owner Profile Snippet & Payout Method */}
        <div className="hairline-card bg-[#fafafa] flex items-center justify-between">
          <div className="space-y-1">
            <span className="eyebrow-label">Landlord Profile</span>
            <h2 className="text-base font-bold text-[#111114]">{ownerProfile.name}</h2>
            <div className="text-xs text-[#6e6e73]">
              TIN: {ownerProfile.taxId} • Management Fee Rate: <strong className="text-[#111114]">{ownerProfile.managementFeeRate}</strong>
            </div>
          </div>

          <div className="text-right">
            <span className="eyebrow-label block mb-1">Direct Bank Disbursement Account</span>
            <div className="text-sm font-bold text-[#111114]">{ownerProfile.bankAccount}</div>
            <span className="status-pill status-pill-success mt-1">VERIFIED ESCROW ACCOUNT</span>
          </div>
        </div>

        {/* Financial KPI Grid */}
        <div className="grid grid-cols-4 gap-5">
          {ownerKpis.map((kpi) => (
            <div key={kpi.label} className="hairline-card space-y-2">
              <span className="eyebrow-label">{kpi.label}</span>
              <div className="text-2xl font-bold text-[#111114] tracking-tight">{kpi.value}</div>
              <div className="text-xs text-[#6e6e73]">{kpi.sub}</div>
            </div>
          ))}
        </div>

        {/* Owned Property Performance Table */}
        <div className="hairline-card space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-[#111114]">Owned Property Yield Breakdown</h2>
              <p className="text-xs text-[#6e6e73]">Individual unit occupancy and monthly net distribution</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#e8e8ea] text-[11px] font-semibold text-[#6e6e73] uppercase tracking-wider">
                  <th className="py-2.5 px-3">Building & Unit</th>
                  <th className="py-2.5 px-3">Occupancy Status</th>
                  <th className="py-2.5 px-3">Active Tenant</th>
                  <th className="py-2.5 px-3">Gross Rent Collected</th>
                  <th className="py-2.5 px-3 text-right">Net Owner Distribution</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e8e8ea] text-xs">
                {ownedProperties.map((prop) => (
                  <tr key={prop.unit} className="hover:bg-[#fafafa] transition-colors">
                    <td className="py-3 px-3">
                      <div className="font-semibold text-[#111114]">{prop.building}</div>
                      <div className="text-[11px] text-[#6e6e73]">{prop.unit} ({prop.code})</div>
                    </td>
                    <td className="py-3 px-3">
                      <span className="status-pill status-pill-success">{prop.occupancy}</span>
                    </td>
                    <td className="py-3 px-3 font-medium text-[#111114]">{prop.tenant}</td>
                    <td className="py-3 px-3 font-mono text-[#111114]">{prop.grossRent}</td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-emerald-800">{prop.netPayout}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Monthly Disbursement Statements History */}
        <div className="hairline-card space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-[#111114]">Monthly Bank Disbursement Statements</h2>
              <p className="text-xs text-[#6e6e73]">Audited financial settlement records</p>
            </div>
          </div>

          <div className="space-y-3">
            {disbursementHistory.map((d) => (
              <div key={d.id} className="p-4 rounded-lg border border-[#e8e8ea] bg-white flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-full bg-[#111114] text-white">{d.id}</span>
                    <h3 className="font-bold text-sm text-[#111114]">{d.period} Settlement</h3>
                  </div>
                  <div className="text-xs text-[#6e6e73]">
                    Disbursed on {d.date} • Gross Collected: {d.gross}
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-base font-bold text-emerald-800">{d.net}</div>
                  <button className="btn-pill-secondary text-xs py-1.5 px-3 gap-1">
                    <Download className="w-3.5 h-3.5 text-[#6e6e73]" /> Download Statement PDF
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
