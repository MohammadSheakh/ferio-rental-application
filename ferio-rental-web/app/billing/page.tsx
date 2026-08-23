'use client';

import { useState } from 'react';
import { Header } from '@/components/Header';
import { CreditCard, CheckCircle2, XCircle, ShieldAlert, Plus, X } from 'lucide-react';

export default function BillingPage() {
  const [isRecordPaymentOpen, setIsRecordPaymentOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'LEDGER' | 'CASH_VERIFICATION'>('LEDGER');

  const [pendingCashCollections, setPendingCashCollections] = useState([
    {
      id: 'pay-cash-101',
      tenant: 'Mahmudur Rahman',
      unit: 'Gulshan Heights #4-C',
      amount: '৳ 85,000',
      collectedBy: 'Caretaker Rafiqul Islam',
      collectedAt: '22 Aug 2026, 11:30 AM',
      receiptRef: 'RCPT-CASH-8812',
    },
    {
      id: 'pay-cash-102',
      tenant: 'Kamrul Hasan',
      unit: 'Rose Valley #B-1',
      amount: '৳ 48,000',
      collectedBy: 'Building Manager Subrata',
      collectedAt: '21 Aug 2026, 05:15 PM',
      receiptRef: 'RCPT-CASH-8810',
    },
  ]);

  const [ledgerEntries, setLedgerEntries] = useState([
    {
      id: 'led-1',
      date: '01 Aug 2026',
      type: 'CHARGE',
      desc: 'Issued Monthly Rent Invoice #INV-2026-08-012',
      debit: '৳ 45,000.00',
      credit: '৳ 0.00',
      balanceAfter: '৳ 45,000.00',
      ref: 'INVOICE #INV-2026-08-012',
    },
    {
      id: 'led-2',
      date: '05 Aug 2026',
      type: 'PAYMENT',
      desc: 'bKash Merchant Payment #BKASH-TXN-99887766',
      debit: '৳ 0.00',
      credit: '৳ 45,000.00',
      balanceAfter: '৳ 0.00',
      ref: 'PAYMENT #PAY-2026-08-001',
    },
  ]);

  const handleVerifyCash = (cashId: string, approve: boolean) => {
    if (approve) {
      const target = pendingCashCollections.find((c) => c.id === cashId);
      if (target) {
        setLedgerEntries([
          {
            id: `led-${Date.now()}`,
            date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
            type: 'PAYMENT',
            desc: `Verified Cash Collection from ${target.tenant} (${target.collectedBy})`,
            debit: '৳ 0.00',
            credit: `${target.amount}.00`,
            balanceAfter: '৳ 0.00',
            ref: `PAYMENT #${target.receiptRef}`,
          },
          ...ledgerEntries,
        ]);
      }
    }
    setPendingCashCollections((prev) => prev.filter((c) => c.id !== cashId));
  };

  return (
    <div>
      <Header
        title="Financial Ledger & Payment Gateway"
        subtitle="Append-only double-entry financial system of record, MFS collections & cash maker-checker verification"
        quickActionLabel="Record Payment"
        onQuickAction={() => setIsRecordPaymentOpen(true)}
      />

      <div className="p-8 space-y-8">
        {/* Financial Summary Cards */}
        <div className="grid grid-cols-4 gap-5">
          <div className="hairline-card space-y-2">
            <span className="eyebrow-label">Total Invoiced (Aug)</span>
            <div className="text-2xl font-bold text-[#111114]">৳ 2,145,000</div>
            <div className="text-xs text-[#6e6e73]">48 Rent Invoices Issued</div>
          </div>
          <div className="hairline-card space-y-2">
            <span className="eyebrow-label">Collections Realized</span>
            <div className="text-2xl font-bold text-[#111114]">৳ 1,980,000</div>
            <div className="text-xs text-emerald-700 font-medium">92.3% Realization Rate</div>
          </div>
          <div className="hairline-card space-y-2">
            <span className="eyebrow-label">Outstanding Receivables</span>
            <div className="text-2xl font-bold text-[#111114]">৳ 165,000</div>
            <div className="text-xs text-amber-700 font-medium">2 Overdue Invoices</div>
          </div>
          <div className="hairline-card space-y-2 relative">
            <span className="eyebrow-label">Pending Cash Maker/Checker</span>
            <div className="text-2xl font-bold text-[#111114]">{pendingCashCollections.length} Handover(s)</div>
            <div className="text-xs text-rose-700 font-medium">Requires Admin Verification</div>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-[#e8e8ea] text-xs font-semibold">
          <button
            onClick={() => setActiveTab('LEDGER')}
            className={`pb-3 px-4 transition-colors border-b-2 ${
              activeTab === 'LEDGER' ? 'border-[#111114] text-[#111114]' : 'border-transparent text-[#6e6e73] hover:text-[#111114]'
            }`}
          >
            Double-Entry Ledger Statement
          </button>
          <button
            onClick={() => setActiveTab('CASH_VERIFICATION')}
            className={`pb-3 px-4 transition-colors border-b-2 flex items-center gap-2 ${
              activeTab === 'CASH_VERIFICATION' ? 'border-[#111114] text-[#111114]' : 'border-transparent text-[#6e6e73] hover:text-[#111114]'
            }`}
          >
            Maker/Checker Cash Verification
            {pendingCashCollections.length > 0 && (
              <span className="w-4 h-4 rounded-full bg-rose-600 text-white text-[10px] flex items-center justify-center font-bold">
                {pendingCashCollections.length}
              </span>
            )}
          </button>
        </div>

        {/* Tab 1: Double-Entry Ledger */}
        {activeTab === 'LEDGER' && (
          <div className="hairline-card space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-[#111114]">Double-Entry Tenant Ledger Audit Trail</h2>
                <p className="text-xs text-[#6e6e73]">
                  Immutable transaction history (Debit = Charge, Credit = Payment)
                </p>
              </div>
              <button className="btn-pill-secondary text-xs py-1.5 px-3">
                Export Audit Trail PDF
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#e8e8ea] text-[11px] font-semibold text-[#6e6e73] uppercase tracking-wider">
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3">Description</th>
                    <th className="py-2.5 px-3">Reference</th>
                    <th className="py-2.5 px-3 text-right">Debit (Charge)</th>
                    <th className="py-2.5 px-3 text-right">Credit (Payment)</th>
                    <th className="py-2.5 px-3 text-right">Balance After</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e8e8ea] text-xs">
                  {ledgerEntries.map((entry) => (
                    <tr key={entry.id} className="hover:bg-[#fafafa] transition-colors">
                      <td className="py-3 px-3 text-[#6e6e73] text-[11px]">{entry.date}</td>
                      <td className="py-3 px-3">
                        {entry.type === 'CHARGE' ? (
                          <span className="status-pill status-pill-warning">CHARGE</span>
                        ) : (
                          <span className="status-pill status-pill-success">PAYMENT</span>
                        )}
                      </td>
                      <td className="py-3 px-3 font-medium text-[#111114]">{entry.desc}</td>
                      <td className="py-3 px-3 font-mono text-[11px] text-[#6e6e73]">{entry.ref}</td>
                      <td className="py-3 px-3 text-right font-mono font-medium text-[#111114]">{entry.debit}</td>
                      <td className="py-3 px-3 text-right font-mono font-medium text-emerald-700">{entry.credit}</td>
                      <td className="py-3 px-3 text-right font-mono font-semibold text-[#111114]">{entry.balanceAfter}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 2: Maker/Checker Cash Verification Queue */}
        {activeTab === 'CASH_VERIFICATION' && (
          <div className="hairline-card space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-[#111114]">Caretaker & Manager Cash Collection Verification</h2>
              <p className="text-xs text-[#6e6e73]">
                Admin Maker/Checker verification for physical cash handovers before ledger posting
              </p>
            </div>

            {pendingCashCollections.length === 0 ? (
              <div className="py-12 text-center text-xs text-[#6e6e73]">
                No pending cash collections requiring verification.
              </div>
            ) : (
              <div className="space-y-3">
                {pendingCashCollections.map((cash) => (
                  <div key={cash.id} className="p-4 rounded-lg border border-[#e8e8ea] bg-white flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-[#111114]">{cash.tenant}</span>
                        <span className="text-xs text-[#6e6e73]">({cash.unit})</span>
                      </div>
                      <div className="text-xs text-[#6e6e73]">
                        Collected by <strong className="text-[#111114]">{cash.collectedBy}</strong> on {cash.collectedAt}
                      </div>
                      <div className="font-mono text-[11px] text-[#6e6e73]">Receipt Ref: {cash.receiptRef}</div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-lg font-bold text-[#111114]">{cash.amount}</div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleVerifyCash(cash.id, false)}
                          className="btn-pill-secondary text-xs text-rose-600 border-rose-200 hover:bg-rose-50 py-1.5 px-3 gap-1"
                        >
                          <XCircle className="w-3.5 h-3.5" /> Reject
                        </button>
                        <button
                          onClick={() => handleVerifyCash(cash.id, true)}
                          className="btn-pill-primary text-xs bg-emerald-800 hover:bg-emerald-900 py-1.5 px-3 gap-1"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Verify & Post to Ledger
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Record Payment Modal */}
      {isRecordPaymentOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-5 border border-[#e8e8ea]">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-[#111114]">Record Tenant Payment</h3>
              <button onClick={() => setIsRecordPaymentOpen(false)} className="text-[#6e6e73] hover:text-[#111114]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form className="space-y-4 text-xs" onSubmit={(e) => { e.preventDefault(); setIsRecordPaymentOpen(false); }}>
              <div>
                <label className="eyebrow-label block mb-1">Billing Account / Lease</label>
                <select className="w-full p-2.5 bg-[#fafafa] border border-[#e8e8ea] rounded-lg text-[#111114]">
                  <option>Rose Valley #A-4 — Tanvir Hossain (Balance: ৳ 45,000)</option>
                  <option>Gulshan Heights #4-C — Mahmudur Rahman (Balance: ৳ 85,000)</option>
                </select>
              </div>

              <div>
                <label className="eyebrow-label block mb-1">Payment Method</label>
                <select className="w-full p-2.5 bg-[#fafafa] border border-[#e8e8ea] rounded-lg text-[#111114]">
                  <option value="BKASH">bKash Merchant</option>
                  <option value="NAGAD">Nagad</option>
                  <option value="CASH">Cash (Requires Verification)</option>
                  <option value="BANK_TRANSFER">Bank Transfer / Cheque</option>
                </select>
              </div>

              <div>
                <label className="eyebrow-label block mb-1">Amount (BDT)</label>
                <input type="number" defaultValue={85000} className="w-full p-2.5 bg-[#fafafa] border border-[#e8e8ea] rounded-lg text-[#111114] font-semibold" required />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button type="button" onClick={() => setIsRecordPaymentOpen(false)} className="btn-pill-secondary text-xs py-2 px-4">
                  Cancel
                </button>
                <button type="submit" className="btn-pill-primary text-xs py-2 px-4">
                  Post Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
