'use client';

import { useState } from 'react';
import { Header } from '@/components/Header';
import { FileText, Plus, ShieldCheck, CheckCircle2, AlertCircle, Calendar, UserCheck } from 'lucide-react';

export default function LeasesPage() {
  const [leases, setLeases] = useState([
    {
      id: 'lease-101',
      leaseNumber: 'LEASE-2026-001',
      unit: 'Rose Valley #A-4',
      primaryTenant: 'Tanvir Hossain',
      phone: '+8801712345678',
      rentAmount: '৳ 45,000',
      securityDeposit: '৳ 90,000',
      startDate: '01 Sep 2026',
      endDate: '31 Aug 2027',
      status: 'ACTIVE',
      guarantor: 'Dr. Shahabuddin (Father)',
    },
    {
      id: 'lease-102',
      leaseNumber: 'LEASE-2026-002',
      unit: 'Banani Tower #B-2',
      primaryTenant: 'Sultana Parveen',
      phone: '+8801811223344',
      rentAmount: '৳ 62,000',
      securityDeposit: '৳ 124,000',
      startDate: '15 Sep 2026',
      endDate: '14 Sep 2027',
      status: 'ACTIVE',
      guarantor: 'Mahbubur Rahman (Uncle)',
    },
    {
      id: 'lease-103',
      leaseNumber: 'LEASE-2026-003',
      unit: 'Rose Valley #A-3',
      primaryTenant: 'Kamrul Hasan',
      phone: '+8801911998877',
      rentAmount: '৳ 48,000',
      securityDeposit: '৳ 96,000',
      startDate: '01 Oct 2026',
      endDate: '30 Sep 2027',
      status: 'DRAFT',
      guarantor: 'Farhana Begum (Mother)',
    },
  ]);

  const handleActivateLease = (leaseId: string) => {
    setLeases((prev) =>
      prev.map((l) => (l.id === leaseId ? { ...l, status: 'ACTIVE' } : l))
    );
  };

  return (
    <div>
      <Header
        title="Lease Agreements & Occupancy Lifecycle"
        subtitle="Manage legally binding rental contracts, co-tenants, guarantors, and atomic activations"
        quickActionLabel="Draft New Lease"
      />

      <div className="p-8 space-y-8">
        {/* Lease Overview Cards */}
        <div className="grid grid-cols-3 gap-6">
          <div className="hairline-card space-y-2">
            <span className="eyebrow-label">Active Contracts</span>
            <div className="text-2xl font-bold text-[#111114]">48 Leases</div>
            <div className="text-xs text-[#6e6e73]">100% Verified Tenant Profiles</div>
          </div>
          <div className="hairline-card space-y-2">
            <span className="eyebrow-label">Security Deposits Held</span>
            <div className="text-2xl font-bold text-[#111114]">৳ 4,320,000</div>
            <div className="text-xs text-[#6e6e73]">Segregated Escrow Accounts</div>
          </div>
          <div className="hairline-card space-y-2">
            <span className="eyebrow-label">Expiring Next 30 Days</span>
            <div className="text-2xl font-bold text-[#111114]">3 Leases</div>
            <div className="text-xs text-amber-700 font-medium">Renewal Notice Sent</div>
          </div>
        </div>

        {/* Leases Data Table */}
        <div className="hairline-card space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-[#111114]">Lease Repository & Status State Machine</h2>
              <p className="text-xs text-[#6e6e73]">
                Draft → Pending Approval → Signed → Active → Notice Given → Terminated
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#e8e8ea] text-[11px] font-semibold text-[#6e6e73] uppercase tracking-wider">
                  <th className="py-2.5 px-3">Lease #</th>
                  <th className="py-2.5 px-3">Unit</th>
                  <th className="py-2.5 px-3">Primary Tenant</th>
                  <th className="py-2.5 px-3">Monthly Rent</th>
                  <th className="py-2.5 px-3">Security Deposit</th>
                  <th className="py-2.5 px-3">Guarantor</th>
                  <th className="py-2.5 px-3">Term Dates</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e8e8ea] text-xs">
                {leases.map((lease) => (
                  <tr key={lease.id} className="hover:bg-[#fafafa] transition-colors">
                    <td className="py-3 px-3 font-mono font-semibold text-[#111114]">{lease.leaseNumber}</td>
                    <td className="py-3 px-3 font-medium text-[#111114]">{lease.unit}</td>
                    <td className="py-3 px-3">
                      <div className="font-medium text-[#111114]">{lease.primaryTenant}</div>
                      <div className="text-[11px] text-[#6e6e73]">{lease.phone}</div>
                    </td>
                    <td className="py-3 px-3 font-semibold text-[#111114]">{lease.rentAmount}</td>
                    <td className="py-3 px-3 text-[#6e6e73]">{lease.securityDeposit}</td>
                    <td className="py-3 px-3 text-[#6e6e73]">{lease.guarantor}</td>
                    <td className="py-3 px-3 text-[11px] text-[#6e6e73]">
                      <div>{lease.startDate}</div>
                      <div>to {lease.endDate}</div>
                    </td>
                    <td className="py-3 px-3">
                      {lease.status === 'ACTIVE' && (
                        <span className="status-pill status-pill-success">ACTIVE</span>
                      )}
                      {lease.status === 'DRAFT' && (
                        <span className="status-pill status-pill-warning">DRAFT</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right">
                      {lease.status === 'DRAFT' ? (
                        <button
                          onClick={() => handleActivateLease(lease.id)}
                          className="btn-pill-primary text-xs py-1 px-3"
                        >
                          Activate Lease
                        </button>
                      ) : (
                        <button className="btn-pill-secondary text-xs py-1 px-3">
                          View Agreement
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
