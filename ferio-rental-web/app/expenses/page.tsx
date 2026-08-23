'use client';

import { useState } from 'react';
import { Header } from '@/components/Header';
import { DollarSign, Receipt, CheckCircle2, XCircle, Plus, X, Upload } from 'lucide-react';

export default function ExpensesPage() {
  const [isLogExpenseOpen, setIsLogExpenseOpen] = useState(false);

  const [expenses, setExpenses] = useState([
    {
      id: 'EXP-2026-041',
      property: 'Rose Valley Heights',
      unit: 'Apt #A-2',
      category: 'MAINTENANCE',
      description: 'Master bathroom pipe leakage & sanitary replacement',
      amount: '৳ 8,500.00',
      recordedBy: 'Subrata (Property Manager)',
      date: '12 Aug 2026',
      status: 'APPROVED',
    },
    {
      id: 'EXP-2026-039',
      property: 'Rose Valley Heights',
      unit: 'Common Area',
      category: 'GENERATOR',
      description: 'Building backup generator diesel fuel refill (200L)',
      amount: '৳ 22,000.00',
      recordedBy: 'Rafiqul Islam (Caretaker)',
      date: '05 Aug 2026',
      status: 'APPROVED',
    },
    {
      id: 'EXP-2026-035',
      property: 'Gulshan Residency',
      unit: 'Building Core',
      category: 'SECURITY',
      description: 'Monthly security guard payroll stipend (4 Guards)',
      amount: '৳ 64,000.00',
      recordedBy: 'Subrata (Property Manager)',
      date: '01 Aug 2026',
      status: 'APPROVED',
    },
  ]);

  return (
    <div>
      <Header
        title="Property Expenses & Landlord Payout Deductions"
        subtitle="Log property maintenance expenses, generator fuel, taxes, and staff payroll for automated owner disbursement settlement"
        quickActionLabel="Log Expense"
        onQuickAction={() => setIsLogExpenseOpen(true)}
      />

      <div className="p-8 space-y-8">
        {/* Expenses Summary Cards */}
        <div className="grid grid-cols-4 gap-5">
          <div className="hairline-card space-y-2">
            <span className="eyebrow-label">Total Outflow (Aug)</span>
            <div className="text-2xl font-bold text-[#111114]">৳ 94,500.00</div>
            <div className="text-xs text-[#6e6e73]">Across 3 Properties</div>
          </div>
          <div className="hairline-card space-y-2">
            <span className="eyebrow-label">Maintenance Repairs</span>
            <div className="text-2xl font-bold text-[#111114]">৳ 8,500.00</div>
            <div className="text-xs text-[#6e6e73]">Deducted from Owner Net Payout</div>
          </div>
          <div className="hairline-card space-y-2">
            <span className="eyebrow-label">Generator Fuel & WASA</span>
            <div className="text-2xl font-bold text-[#111114]">৳ 22,000.00</div>
            <div className="text-xs text-emerald-700 font-medium">Verified Receipt Uploaded</div>
          </div>
          <div className="hairline-card space-y-2">
            <span className="eyebrow-label">Staff & Security Payroll</span>
            <div className="text-2xl font-bold text-[#111114]">৳ 64,000.00</div>
            <div className="text-xs text-[#6e6e73]">4 Caretakers & Guards</div>
          </div>
        </div>

        {/* Expenses Table */}
        <div className="hairline-card space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-[#111114]">Property Expenses & Voucher Audit Log</h2>
              <p className="text-xs text-[#6e6e73]">Vouchers approved for net landlord payout deduction</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#e8e8ea] text-[11px] font-semibold text-[#6e6e73] uppercase tracking-wider">
                  <th className="py-2.5 px-3">Voucher #</th>
                  <th className="py-2.5 px-3">Property & Scope</th>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3">Description</th>
                  <th className="py-2.5 px-3">Recorded By</th>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Amount</th>
                  <th className="py-2.5 px-3 text-right">Approval Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e8e8ea] text-xs">
                {expenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-[#fafafa] transition-colors">
                    <td className="py-3 px-3 font-mono font-semibold text-[#111114]">{exp.id}</td>
                    <td className="py-3 px-3">
                      <div className="font-semibold text-[#111114]">{exp.property}</div>
                      <div className="text-[11px] text-[#6e6e73]">{exp.unit}</div>
                    </td>
                    <td className="py-3 px-3">
                      <span className="status-pill status-pill-neutral font-mono text-[10px]">{exp.category}</span>
                    </td>
                    <td className="py-3 px-3 font-medium text-[#111114]">{exp.description}</td>
                    <td className="py-3 px-3 text-[#6e6e73]">{exp.recordedBy}</td>
                    <td className="py-3 px-3 text-[#6e6e73] text-[11px]">{exp.date}</td>
                    <td className="py-3 px-3 font-mono font-bold text-rose-700">{exp.amount}</td>
                    <td className="py-3 px-3 text-right">
                      <span className="status-pill status-pill-success">{exp.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Log Expense Modal */}
      {isLogExpenseOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-5 border border-[#e8e8ea]">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-[#111114]">Log Property Expense Voucher</h3>
              <button onClick={() => setIsLogExpenseOpen(false)} className="text-[#6e6e73] hover:text-[#111114]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form className="space-y-4 text-xs" onSubmit={(e) => { e.preventDefault(); setIsLogExpenseOpen(false); }}>
              <div>
                <label className="eyebrow-label block mb-1">Target Property & Unit</label>
                <select className="w-full p-2.5 bg-[#fafafa] border border-[#e8e8ea] rounded-lg text-[#111114]">
                  <option>Rose Valley Heights — Common Area</option>
                  <option>Rose Valley Heights — Apt #A-2</option>
                  <option>Gulshan Residency — Building Core</option>
                </select>
              </div>

              <div>
                <label className="eyebrow-label block mb-1">Expense Category</label>
                <select className="w-full p-2.5 bg-[#fafafa] border border-[#e8e8ea] rounded-lg text-[#111114]">
                  <option value="MAINTENANCE">MAINTENANCE & Plumbing</option>
                  <option value="GENERATOR">GENERATOR Diesel & WASA</option>
                  <option value="SECURITY">SECURITY & Caretaker Payroll</option>
                  <option value="CLEANING">CLEANING & Waste Removal</option>
                  <option value="PROPERTY_TAX">PROPERTY_TAX Municipal</option>
                </select>
              </div>

              <div>
                <label className="eyebrow-label block mb-1">Expense Amount (BDT)</label>
                <input type="number" defaultValue={8500} className="w-full p-2.5 bg-[#fafafa] border border-[#e8e8ea] rounded-lg text-[#111114] font-bold" required />
              </div>

              <div>
                <label className="eyebrow-label block mb-1">Description & Voucher Note</label>
                <textarea rows={2} placeholder="Explain the expense detail..." className="w-full p-2.5 bg-[#fafafa] border border-[#e8e8ea] rounded-lg text-[#111114]" required></textarea>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button type="button" onClick={() => setIsLogExpenseOpen(false)} className="btn-pill-secondary text-xs py-2 px-4">
                  Cancel
                </button>
                <button type="submit" className="btn-pill-primary text-xs py-2 px-5">
                  Submit Voucher
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
