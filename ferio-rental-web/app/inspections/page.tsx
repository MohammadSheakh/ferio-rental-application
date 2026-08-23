'use client';

import { useState } from 'react';
import { Header } from '@/components/Header';
import { ClipboardCheck, ShieldAlert, CheckCircle2, FileText, Camera, Plus, X } from 'lucide-react';

export default function InspectionsPage() {
  const [isNewInspectionOpen, setIsNewInspectionOpen] = useState(false);

  const [inspections, setInspections] = useState([
    {
      id: 'INSP-2026-089',
      property: 'Rose Valley Heights',
      unit: 'Apt #A-4',
      type: 'MOVE_OUT',
      tenant: 'Tanvir Hossain',
      inspector: 'Property Manager Subrata',
      date: '22 Aug 2026',
      status: 'COMPLETED',
      damagedItems: 1, // Bathroom pipe leakage
      notes: 'Move-out inspection completed before security deposit settlement.',
    },
    {
      id: 'INSP-2025-012',
      property: 'Rose Valley Heights',
      unit: 'Apt #A-4',
      type: 'MOVE_IN',
      tenant: 'Tanvir Hossain',
      inspector: 'Caretaker Rafiqul Islam',
      date: '01 Sep 2025',
      status: 'COMPLETED',
      damagedItems: 0,
      notes: 'Initial move-in condition verified & acknowledged by tenant.',
    },
  ]);

  return (
    <div>
      <Header
        title="Property Inspections & Move-In/Out Evidence"
        subtitle="Audited unit condition reports, move-in/out photo logs, and security deposit damage assessment"
        quickActionLabel="New Unit Inspection"
        onQuickAction={() => setIsNewInspectionOpen(true)}
      />

      <div className="p-8 space-y-8">
        {/* Inspection KPI Cards */}
        <div className="grid grid-cols-3 gap-6">
          <div className="hairline-card space-y-2">
            <span className="eyebrow-label">Total Inspections Executed</span>
            <div className="text-2xl font-bold text-[#111114]">38 Audit Reports</div>
            <div className="text-xs text-[#6e6e73]">Move-In, Move-Out & Annual Audits</div>
          </div>
          <div className="hairline-card space-y-2">
            <span className="eyebrow-label">Pending Move-Out Audits</span>
            <div className="text-2xl font-bold text-[#111114]">2 Pending Exit Checks</div>
            <div className="text-xs text-amber-700 font-medium">Pre-requisite for Deposit Refunds</div>
          </div>
          <div className="hairline-card space-y-2">
            <span className="eyebrow-label">Damaged Items Identified</span>
            <div className="text-2xl font-bold text-[#111114]">3 Claim Deductions</div>
            <div className="text-xs text-emerald-700 font-medium">100% Photo Hash Verified</div>
          </div>
        </div>

        {/* Inspections Table */}
        <div className="hairline-card space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-[#111114]">Inspection Reports Audit History</h2>
              <p className="text-xs text-[#6e6e73]">Digital condition reports signed by Caretaker and Tenant</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#e8e8ea] text-[11px] font-semibold text-[#6e6e73] uppercase tracking-wider">
                  <th className="py-2.5 px-3">Report ID</th>
                  <th className="py-2.5 px-3">Property & Unit</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Tenant / Resident</th>
                  <th className="py-2.5 px-3">Inspector</th>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Damages Noted</th>
                  <th className="py-2.5 px-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e8e8ea] text-xs">
                {inspections.map((insp) => (
                  <tr key={insp.id} className="hover:bg-[#fafafa] transition-colors">
                    <td className="py-3 px-3 font-mono font-semibold text-[#111114]">{insp.id}</td>
                    <td className="py-3 px-3">
                      <div className="font-semibold text-[#111114]">{insp.property}</div>
                      <div className="text-[11px] text-[#6e6e73]">{insp.unit}</div>
                    </td>
                    <td className="py-3 px-3">
                      <span className="status-pill status-pill-neutral font-mono text-[10px]">{insp.type}</span>
                    </td>
                    <td className="py-3 px-3 font-medium text-[#111114]">{insp.tenant}</td>
                    <td className="py-3 px-3 text-[#6e6e73]">{insp.inspector}</td>
                    <td className="py-3 px-3 text-[#6e6e73] text-[11px]">{insp.date}</td>
                    <td className="py-3 px-3">
                      {insp.damagedItems > 0 ? (
                        <span className="status-pill status-pill-warning text-rose-700 bg-rose-50 border-rose-200">
                          {insp.damagedItems} Damage(s)
                        </span>
                      ) : (
                        <span className="status-pill status-pill-success">0 Damages</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <span className="status-pill status-pill-success">{insp.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* New Inspection Modal */}
      {isNewInspectionOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-5 border border-[#e8e8ea]">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-[#111114]">Create Unit Condition Inspection</h3>
              <button onClick={() => setIsNewInspectionOpen(false)} className="text-[#6e6e73] hover:text-[#111114]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form className="space-y-4 text-xs" onSubmit={(e) => { e.preventDefault(); setIsNewInspectionOpen(false); }}>
              <div>
                <label className="eyebrow-label block mb-1">Select Property & Unit</label>
                <select className="w-full p-2.5 bg-[#fafafa] border border-[#e8e8ea] rounded-lg text-[#111114]">
                  <option>Rose Valley Heights — Apt #A-4 (Tanvir Hossain)</option>
                  <option>Gulshan Residency — Suite #4-C (Mahmudur Rahman)</option>
                </select>
              </div>

              <div>
                <label className="eyebrow-label block mb-1">Inspection Type</label>
                <select className="w-full p-2.5 bg-[#fafafa] border border-[#e8e8ea] rounded-lg text-[#111114]">
                  <option value="MOVE_IN">MOVE_IN — Pre-Occupancy Baseline</option>
                  <option value="MOVE_OUT">MOVE_OUT — Pre-Deposit Refund Check</option>
                  <option value="PERIODIC">PERIODIC — Annual Maintenance Audit</option>
                </select>
              </div>

              <div>
                <label className="eyebrow-label block mb-1">Condition Summary & Damage Notes</label>
                <textarea rows={3} placeholder="Note any wall paint scuffs, sanitary fixtures condition, electrical fittings..." className="w-full p-2.5 bg-[#fafafa] border border-[#e8e8ea] rounded-lg text-[#111114]" required></textarea>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button type="button" onClick={() => setIsNewInspectionOpen(false)} className="btn-pill-secondary text-xs py-2 px-4">
                  Cancel
                </button>
                <button type="submit" className="btn-pill-primary text-xs py-2 px-5">
                  Save Inspection
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
