'use client';

import { useState } from 'react';
import { Header } from '@/components/Header';
import {
  FileText,
  CreditCard,
  Wrench,
  Download,
  AlertCircle,
  CheckCircle2,
  Clock,
  Phone,
  MessageSquare,
  Plus,
  X,
  Upload,
} from 'lucide-react';

export default function TenantPortalPage() {
  const [isPayRentOpen, setIsPayRentOpen] = useState(false);
  const [isSubmitTicketOpen, setIsSubmitTicketOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'BKASH' | 'NAGAD' | 'CASH'>('BKASH');

  const tenantLease = {
    leaseNumber: 'LEASE-2026-001',
    unitName: 'Rose Valley Heights — Apt #A-4',
    address: 'House 42, Road 11, Block D, Banani, Dhaka',
    rentAmount: '৳ 45,000',
    dueDate: '05 Sep 2026',
    gracePeriodEnd: '10 Sep 2026',
    status: 'ACTIVE',
    securityDepositHeld: '৳ 90,000',
    caretakerName: 'Rafiqul Islam',
    caretakerPhone: '+8801711223344',
  };

  const [paymentHistory, setPaymentHistory] = useState([
    {
      id: 'PAY-2026-08-001',
      invoiceNumber: 'INV-2026-08-012',
      period: 'August 2026',
      amount: '৳ 45,000',
      paidAt: '05 Aug 2026',
      method: 'bKash Merchant',
      txnRef: 'BKASH-TXN-99887766',
      status: 'PAID',
    },
    {
      id: 'PAY-2026-07-001',
      invoiceNumber: 'INV-2026-07-004',
      period: 'July 2026',
      amount: '৳ 45,000',
      paidAt: '04 Jul 2026',
      method: 'bKash Merchant',
      txnRef: 'BKASH-TXN-77665544',
      status: 'PAID',
    },
  ]);

  const [maintenanceTickets, setMaintenanceTickets] = useState([
    {
      id: 'REQ-001',
      category: 'PLUMBING',
      description: 'Master bathroom shower mixer water pressure low.',
      status: 'RESOLVED',
      createdAt: '10 Aug 2026',
      vendor: 'Dhaka Sanitary Works',
    },
  ]);

  const handlePayRentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newPayment = {
      id: `PAY-2026-09-001`,
      invoiceNumber: 'INV-2026-09-001',
      period: 'September 2026',
      amount: '৳ 45,000',
      paidAt: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      method: paymentMethod === 'BKASH' ? 'bKash Merchant' : paymentMethod === 'NAGAD' ? 'Nagad' : 'Cash Handover to Caretaker',
      txnRef: paymentMethod === 'CASH' ? 'PENDING_VERIFICATION' : `MFS-TXN-${Math.floor(Math.random() * 90000000 + 10000000)}`,
      status: paymentMethod === 'CASH' ? 'PENDING_VERIFICATION' : 'PAID',
    };
    setPaymentHistory([newPayment, ...paymentHistory]);
    setIsPayRentOpen(false);
  };

  const handleSubmitTicket = (e: React.FormEvent) => {
    e.preventDefault();
    const newTicket = {
      id: `REQ-00${maintenanceTickets.length + 1}`,
      category: 'ELECTRICAL',
      description: 'Living room main switch box tripping.',
      status: 'OPEN',
      createdAt: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      vendor: 'Pending Dispatch',
    };
    setMaintenanceTickets([newTicket, ...maintenanceTickets]);
    setIsSubmitTicketOpen(false);
  };

  return (
    <div>
      <Header
        title="Tenant Self-Service Portal"
        subtitle="Welcome back, Tanvir Hossain — Unit #A-4 Resident"
        quickActionLabel="Pay Rent Now"
        onQuickAction={() => setIsPayRentOpen(true)}
      />

      <div className="p-8 space-y-8">
        {/* Active Lease Hero Card */}
        <div className="hairline-card bg-[#fafafa] border-[#111114]/20 p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs font-semibold px-2.5 py-1 rounded-full bg-[#111114] text-white">
                {tenantLease.leaseNumber}
              </span>
              <span className="status-pill status-pill-success">ACTIVE LEASE</span>
            </div>

            <div className="text-xs text-[#6e6e73]">
              Security Deposit Held: <strong className="text-[#111114]">{tenantLease.securityDepositHeld}</strong>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-6">
            <div>
              <span className="eyebrow-label block mb-1">Rented Residence</span>
              <h2 className="text-base font-bold text-[#111114]">{tenantLease.unitName}</h2>
              <p className="text-xs text-[#6e6e73] mt-1">{tenantLease.address}</p>
            </div>

            <div>
              <span className="eyebrow-label block mb-1">Next Rent Payment</span>
              <div className="text-2xl font-bold text-[#111114]">{tenantLease.rentAmount}</div>
              <p className="text-xs text-[#6e6e73] mt-1">Due on <strong className="text-[#111114]">{tenantLease.dueDate}</strong> (Grace till {tenantLease.gracePeriodEnd})</p>
            </div>

            <div>
              <span className="eyebrow-label block mb-1">On-Site Caretaker Contact</span>
              <div className="text-sm font-semibold text-[#111114]">{tenantLease.caretakerName}</div>
              <div className="flex items-center gap-2 mt-1">
                <a href={`tel:${tenantLease.caretakerPhone}`} className="btn-pill-secondary text-[11px] py-1 px-2.5 gap-1">
                  <Phone className="w-3 h-3" /> Call Caretaker
                </a>
                <a href={`https://wa.me/${tenantLease.caretakerPhone.replace('+', '')}`} className="btn-pill-primary text-[11px] py-1 px-2.5 gap-1 bg-emerald-800 hover:bg-emerald-900">
                  <MessageSquare className="w-3 h-3" /> WhatsApp
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Payment History & Maintenance Split */}
        <div className="grid grid-cols-3 gap-8">
          {/* Payment History Table */}
          <div className="col-span-2 hairline-card space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-[#111114]">Rent Receipts & Payment History</h2>
                <p className="text-xs text-[#6e6e73]">Download official landlord digital receipts</p>
              </div>
              <button onClick={() => setIsPayRentOpen(true)} className="btn-pill-primary text-xs py-1.5 px-3">
                + Make Rent Payment
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#e8e8ea] text-[11px] font-semibold text-[#6e6e73] uppercase tracking-wider">
                    <th className="py-2.5 px-3">Period</th>
                    <th className="py-2.5 px-3">Amount</th>
                    <th className="py-2.5 px-3">Paid Date</th>
                    <th className="py-2.5 px-3">Method</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Receipt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e8e8ea] text-xs">
                  {paymentHistory.map((pay) => (
                    <tr key={pay.id} className="hover:bg-[#fafafa] transition-colors">
                      <td className="py-3 px-3 font-semibold text-[#111114]">{pay.period}</td>
                      <td className="py-3 px-3 font-mono font-semibold text-[#111114]">{pay.amount}</td>
                      <td className="py-3 px-3 text-[#6e6e73] text-[11px]">{pay.paidAt}</td>
                      <td className="py-3 px-3 text-[#6e6e73]">{pay.method}</td>
                      <td className="py-3 px-3">
                        {pay.status === 'PAID' ? (
                          <span className="status-pill status-pill-success">PAID</span>
                        ) : (
                          <span className="status-pill status-pill-warning">PENDING VERIFICATION</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <button className="btn-pill-secondary text-xs py-1 px-2.5 gap-1">
                          <Download className="w-3 h-3 text-[#6e6e73]" /> PDF
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Maintenance Tickets Widget */}
          <div className="hairline-card space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-[#111114]">Maintenance Requests</h2>
                <p className="text-xs text-[#6e6e73]">Report repairs to caretaker</p>
              </div>
              <button onClick={() => setIsSubmitTicketOpen(true)} className="btn-pill-primary text-xs py-1.5 px-3">
                + Report Issue
              </button>
            </div>

            <div className="space-y-3">
              {maintenanceTickets.map((t) => (
                <div key={t.id} className="p-3.5 rounded-lg border border-[#e8e8ea] bg-white space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-semibold text-[#111114]">{t.id}</span>
                    {t.status === 'RESOLVED' ? (
                      <span className="status-pill status-pill-success">RESOLVED</span>
                    ) : (
                      <span className="status-pill status-pill-warning">OPEN</span>
                    )}
                  </div>
                  <p className="text-xs text-[#111114] font-medium">"{t.description}"</p>
                  <div className="text-[11px] text-[#6e6e73] flex justify-between pt-1 border-t border-[#e8e8ea]">
                    <span>Category: {t.category}</span>
                    <span>{t.createdAt}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Pay Rent Modal */}
      {isPayRentOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-5 border border-[#e8e8ea]">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-[#111114]">Pay September 2026 Rent</h3>
              <button onClick={() => setIsPayRentOpen(false)} className="text-[#6e6e73] hover:text-[#111114]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form className="space-y-4 text-xs" onSubmit={handlePayRentSubmit}>
              <div className="p-3 bg-[#fafafa] rounded-lg border border-[#e8e8ea] flex justify-between items-center">
                <div>
                  <div className="text-xs text-[#6e6e73]">Monthly Rent Amount</div>
                  <div className="text-xl font-bold text-[#111114]">৳ 45,000.00</div>
                </div>
                <span className="status-pill status-pill-neutral">DUE SEP 05</span>
              </div>

              <div>
                <label className="eyebrow-label block mb-2">Select Payment Method</label>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('BKASH')}
                    className={`p-3 rounded-lg border text-center font-medium transition-all ${
                      paymentMethod === 'BKASH' ? 'border-[#111114] bg-pink-50 text-pink-700 font-bold' : 'border-[#e8e8ea] text-[#6e6e73]'
                    }`}
                  >
                    bKash MFS
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('NAGAD')}
                    className={`p-3 rounded-lg border text-center font-medium transition-all ${
                      paymentMethod === 'NAGAD' ? 'border-[#111114] bg-orange-50 text-orange-700 font-bold' : 'border-[#e8e8ea] text-[#6e6e73]'
                    }`}
                  >
                    Nagad
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('CASH')}
                    className={`p-3 rounded-lg border text-center font-medium transition-all ${
                      paymentMethod === 'CASH' ? 'border-[#111114] bg-slate-100 text-[#111114] font-bold' : 'border-[#e8e8ea] text-[#6e6e73]'
                    }`}
                  >
                    Cash Handover
                  </button>
                </div>
              </div>

              {paymentMethod !== 'CASH' ? (
                <div>
                  <label className="eyebrow-label block mb-1">MFS Transaction ID / Reference</label>
                  <input type="text" placeholder="e.g. BKASH-TXN-99887766" className="w-full p-2.5 bg-[#fafafa] border border-[#e8e8ea] rounded-lg text-[#111114] font-mono" required />
                </div>
              ) : (
                <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-xs text-amber-800">
                  Cash payment will be submitted to Caretaker <strong>Rafiqul Islam</strong>. Once verified, your receipt will be issued.
                </div>
              )}

              <div className="pt-2 flex justify-end gap-2">
                <button type="button" onClick={() => setIsPayRentOpen(false)} className="btn-pill-secondary text-xs py-2 px-4">
                  Cancel
                </button>
                <button type="submit" className="btn-pill-primary text-xs py-2 px-5">
                  Confirm Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Report Maintenance Issue Modal */}
      {isSubmitTicketOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-5 border border-[#e8e8ea]">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-[#111114]">Report Maintenance Issue</h3>
              <button onClick={() => setIsSubmitTicketOpen(false)} className="text-[#6e6e73] hover:text-[#111114]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form className="space-y-4 text-xs" onSubmit={handleSubmitTicket}>
              <div>
                <label className="eyebrow-label block mb-1">Issue Category</label>
                <select className="w-full p-2.5 bg-[#fafafa] border border-[#e8e8ea] rounded-lg text-[#111114]">
                  <option value="PLUMBING">Plumbing & Water Supply</option>
                  <option value="ELECTRICAL">Electrical & Wiring</option>
                  <option value="HVAC">AC / Air Conditioning</option>
                  <option value="OTHER">General Repairs</option>
                </select>
              </div>

              <div>
                <label className="eyebrow-label block mb-1">Problem Description</label>
                <textarea rows={3} placeholder="Please describe the issue in detail..." className="w-full p-2.5 bg-[#fafafa] border border-[#e8e8ea] rounded-lg text-[#111114]" required></textarea>
              </div>

              <div>
                <label className="eyebrow-label block mb-1">Attach Photo Evidence (Optional)</label>
                <div className="p-4 border-2 border-dashed border-[#e8e8ea] rounded-lg text-center cursor-pointer hover:bg-[#fafafa]">
                  <Upload className="w-5 h-5 text-[#6e6e73] mx-auto mb-1" />
                  <span className="text-xs text-[#6e6e73]">Click to upload photo from mobile/camera</span>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button type="button" onClick={() => setIsSubmitTicketOpen(false)} className="btn-pill-secondary text-xs py-2 px-4">
                  Cancel
                </button>
                <button type="submit" className="btn-pill-primary text-xs py-2 px-5">
                  Submit Ticket
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
