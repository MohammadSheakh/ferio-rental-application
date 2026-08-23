'use client';

import { useState } from 'react';
import { Header } from '@/components/Header';
import { Users, UserPlus, ShieldCheck, CheckCircle2, Clock, Calendar, Search, ArrowRight } from 'lucide-react';

export default function CrmPage() {
  const leads = [
    {
      id: 'lead-1',
      name: 'Ashraful Alam',
      phone: '+8801711002233',
      occupation: 'Senior Software Architect',
      employer: 'Therap BD Ltd',
      interestedUnit: 'Rose Valley #A-4',
      budget: '৳ 45,000 / mo',
      source: 'WALK_IN',
      stage: 'APPLICATION_SUBMITTED',
      verifications: [
        { type: 'NID_MANUAL', status: 'VERIFIED', label: 'Bangladesh NID Manual Check' },
        { type: 'PHONE', status: 'VERIFIED', label: 'Phone Number Verification' },
        { type: 'EMPLOYER_CONTACT', status: 'VERIFIED', label: 'Employer HR Verification' },
        { type: 'GUARANTOR_CONTACT', status: 'PENDING', label: 'Guarantor Phone Call' },
      ],
    },
    {
      id: 'lead-2',
      name: 'Dr. Nusrat Jahan',
      phone: '+8801811445566',
      occupation: 'Assistant Professor (Medicine)',
      employer: 'Square Hospital Ltd',
      interestedUnit: 'Gulshan Heights #4-C',
      budget: '৳ 85,000 / mo',
      source: 'DIRECT_CALL',
      stage: 'VIEWING_SCHEDULED',
      verifications: [
        { type: 'NID_MANUAL', status: 'VERIFIED', label: 'Bangladesh NID Manual Check' },
        { type: 'PHONE', status: 'VERIFIED', label: 'Phone Number Verification' },
        { type: 'EMPLOYER_CONTACT', status: 'PENDING', label: 'Employer HR Verification' },
        { type: 'GUARANTOR_CONTACT', status: 'PENDING', label: 'Guarantor Phone Call' },
      ],
    },
  ];

  return (
    <div>
      <Header
        title="Tenant Screening & Lead CRM"
        subtitle="Manage prospective leads, viewing appointments, applications, and Bangladesh localized verification checklists"
        quickActionLabel="Register Lead"
      />

      <div className="p-8 space-y-8">
        {/* CRM Pipeline Counters */}
        <div className="grid grid-cols-4 gap-5">
          <div className="hairline-card space-y-2">
            <span className="eyebrow-label">New Leads (This Week)</span>
            <div className="text-2xl font-bold text-[#111114]">14 Prospective</div>
            <div className="text-xs text-[#6e6e73]">8 Walk-in, 6 Direct Phone</div>
          </div>
          <div className="hairline-card space-y-2">
            <span className="eyebrow-label">Viewings Scheduled</span>
            <div className="text-2xl font-bold text-[#111114]">6 Viewings</div>
            <div className="text-xs text-emerald-700 font-medium">Scheduled Next 48h</div>
          </div>
          <div className="hairline-card space-y-2">
            <span className="eyebrow-label">Applications Submitted</span>
            <div className="text-2xl font-bold text-[#111114]">4 Applications</div>
            <div className="text-xs text-[#6e6e73]">Under Background Check</div>
          </div>
          <div className="hairline-card space-y-2">
            <span className="eyebrow-label">Approved for Lease</span>
            <div className="text-2xl font-bold text-[#111114]">2 Applications</div>
            <div className="text-xs text-emerald-700 font-medium">Ready for Sign & Deposit</div>
          </div>
        </div>

        {/* Lead Application Screening Cards */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-[#111114]">Active Tenant Screening Applications</h2>

          <div className="grid grid-cols-2 gap-6">
            {leads.map((lead) => (
              <div key={lead.id} className="hairline-card space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-[#e8e8ea]">
                  <div>
                    <h3 className="text-base font-bold text-[#111114]">{lead.name}</h3>
                    <p className="text-xs text-[#6e6e73]">{lead.occupation} at <strong className="text-[#111114]">{lead.employer}</strong></p>
                  </div>
                  <span className="status-pill status-pill-warning">{lead.stage}</span>
                </div>

                <div className="text-xs space-y-1.5 text-[#6e6e73]">
                  <div>Interested Unit: <strong className="text-[#111114]">{lead.interestedUnit}</strong></div>
                  <div>Offered Budget: <strong className="text-[#111114]">{lead.budget}</strong></div>
                  <div>Phone Contact: <strong className="text-[#111114]">{lead.phone}</strong></div>
                </div>

                {/* Verification Checklist */}
                <div className="pt-3 border-t border-[#e8e8ea] space-y-2">
                  <span className="eyebrow-label">Bangladesh Compliance Checklists</span>
                  <div className="space-y-1.5 text-xs">
                    {lead.verifications.map((v) => (
                      <div key={v.type} className="flex items-center justify-between p-2 rounded-lg bg-[#fafafa] border border-[#e8e8ea]">
                        <div className="flex items-center gap-2">
                          {v.status === 'VERIFIED' ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          ) : (
                            <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                          )}
                          <span className="font-medium text-[#111114]">{v.label}</span>
                        </div>
                        <span className={v.status === 'VERIFIED' ? 'status-pill status-pill-success' : 'status-pill status-pill-warning'}>
                          {v.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button className="btn-pill-secondary text-xs py-1.5 px-3">
                    View Documents
                  </button>
                  <button className="btn-pill-primary text-xs py-1.5 px-4">
                    Approve Application
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
