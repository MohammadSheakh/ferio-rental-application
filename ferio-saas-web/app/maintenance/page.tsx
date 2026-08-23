'use client';

import { useState } from 'react';
import { Header } from '@/components/Header';
import { Wrench, AlertCircle, CheckCircle2, Clock, MessageSquare, User, Plus, X } from 'lucide-react';

export default function MaintenancePage() {
  const [requests, setRequests] = useState([
    {
      id: 'req-001',
      unit: 'Rose Valley #A-2',
      reporter: 'Rafiqul Islam (Tenant)',
      category: 'PLUMBING',
      urgency: 'HIGH',
      description: 'Main water supply line pipe leakage in bathroom.',
      whatsappRef: 'wamid.HBgLODgwMTcxMjM0NTY3OA==',
      status: 'ASSIGNED',
      vendor: 'Dhaka Sanitary & Plumbing Works',
      estimatedCost: '৳ 3,500',
      createdAt: '22 Aug 2026, 09:15 AM',
    },
    {
      id: 'req-002',
      unit: 'Banani Tower #B-2',
      reporter: 'Sultana Parveen (Tenant)',
      category: 'ELECTRICAL',
      urgency: 'NORMAL',
      description: 'Master bedroom ceiling fan regulator fault.',
      whatsappRef: 'wamid.HBgLODgwMTgxMTIyMzM0NA==',
      status: 'OPEN',
      vendor: 'Unassigned',
      estimatedCost: '৳ 1,200',
      createdAt: '21 Aug 2026, 04:30 PM',
    },
  ]);

  return (
    <div>
      <Header
        title="Maintenance Operations & Vendor Dispatch"
        subtitle="Manage tenant maintenance requests, WhatsApp incoming logs, vendor contracts, and repair work orders"
        quickActionLabel="Log Repair Request"
      />

      <div className="p-8 space-y-8">
        {/* Operations Overview Cards */}
        <div className="grid grid-cols-4 gap-5">
          <div className="hairline-card space-y-2">
            <span className="eyebrow-label">Open Maintenance</span>
            <div className="text-2xl font-bold text-[#111114]">3 Requests</div>
            <div className="text-xs text-rose-700 font-medium">1 High Urgency</div>
          </div>
          <div className="hairline-card space-y-2">
            <span className="eyebrow-label">Active Work Orders</span>
            <div className="text-2xl font-bold text-[#111114]">2 Dispatched</div>
            <div className="text-xs text-[#6e6e73]">Vendors On-Site</div>
          </div>
          <div className="hairline-card space-y-2">
            <span className="eyebrow-label">Avg Resolution Time</span>
            <div className="text-2xl font-bold text-[#111114]">4.2 Hours</div>
            <div className="text-xs text-emerald-700 font-medium">Within SLA Target</div>
          </div>
          <div className="hairline-card space-y-2">
            <span className="eyebrow-label">Maintenance Cost (Aug)</span>
            <div className="text-2xl font-bold text-[#111114]">৳ 18,500</div>
            <div className="text-xs text-[#6e6e73]">Total Vendor Invoices</div>
          </div>
        </div>

        {/* Maintenance Requests List */}
        <div className="hairline-card space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-[#111114]">Maintenance Request Queue</h2>
              <p className="text-xs text-[#6e6e73]">
                Logged via Tenant Portal, Mobile App, or Caretaker WhatsApp
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {requests.map((req) => (
              <div key={req.id} className="p-4 rounded-lg border border-[#e8e8ea] bg-white space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-full bg-[#111114] text-white">
                      {req.id}
                    </span>
                    <h3 className="font-bold text-sm text-[#111114]">{req.unit}</h3>
                    <span className="text-xs text-[#6e6e73]">({req.category})</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {req.urgency === 'HIGH' && (
                      <span className="status-pill status-pill-error">HIGH URGENCY</span>
                    )}
                    {req.status === 'ASSIGNED' ? (
                      <span className="status-pill status-pill-warning">ASSIGNED TO VENDOR</span>
                    ) : (
                      <span className="status-pill status-pill-neutral">OPEN</span>
                    )}
                  </div>
                </div>

                <p className="text-xs text-[#111114] bg-[#fafafa] p-3 rounded-lg border border-[#e8e8ea]">
                  "{req.description}"
                </p>

                <div className="flex items-center justify-between text-xs text-[#6e6e73]">
                  <div className="flex items-center gap-4">
                    <div>Reporter: <strong className="text-[#111114]">{req.reporter}</strong></div>
                    <div className="flex items-center gap-1 text-emerald-700 font-mono text-[11px]">
                      <MessageSquare className="w-3.5 h-3.5" />
                      WhatsApp: {req.whatsappRef.slice(0, 16)}...
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div>Est. Cost: <strong className="text-[#111114]">{req.estimatedCost}</strong></div>
                    <button className="btn-pill-primary text-xs py-1 px-3">
                      Dispatch Work Order
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
