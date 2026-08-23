'use client';

import { useState, useEffect } from 'react';
import { Header } from '@/components/Header';
import { Shield, Server, Database, Users, Building2, CheckCircle2, AlertTriangle, RefreshCw, Lock, Zap, ArrowUpRight } from 'lucide-react';
import Link from 'next/link';

export default function PlatformAdminPage() {
  const [activeTab, setActiveTab] = useState<'ORGANIZATIONS' | 'MARKETPLACE_MODERATION' | 'INFRA_HEALTH'>('ORGANIZATIONS');
  const [isProvisioningModalOpen, setIsProvisioningModalOpen] = useState(false);

  // Platform Level Overview KPIs
  const platformStats = [
    { label: 'Active Organizations', value: '18 Orgs', sub: 'Multi-Tenant Databases' },
    { label: 'Platform MRR', value: '৳ 385,000', sub: 'SaaS Subscriptions' },
    { label: 'Marketplace Listings', value: '142 Ads', sub: '34 Pending Moderation' },
    { label: 'Database Health', value: '99.98%', sub: 'Postgres & Redis Online' },
  ];

  const [organizations, setOrganizations] = useState([
    {
      id: 'org-101',
      name: 'Dhaka Prime Properties',
      slug: 'dhaka-prime',
      plan: 'PRO',
      status: 'ACTIVE',
      dbName: 'ferio_tenant_dhaka_prime',
      unitsCount: 48,
      unitsQuota: 50,
      createdAt: '12 May 2026',
    },
    {
      id: 'org-102',
      name: 'Banani Commercial Holdings',
      slug: 'banani-commercial',
      plan: 'BUSINESS',
      status: 'ACTIVE',
      dbName: 'ferio_tenant_banani_commercial',
      unitsCount: 180,
      unitsQuota: 500,
      createdAt: '01 Jun 2026',
    },
    {
      id: 'org-103',
      name: 'Gulshan Residence Ltd',
      slug: 'gulshan-residence',
      plan: 'STARTER',
      status: 'PROVISIONING',
      dbName: 'ferio_tenant_gulshan_residence',
      unitsCount: 4,
      unitsQuota: 5,
      createdAt: '22 Aug 2026',
    },
  ]);

  const [pendingListings, setPendingListings] = useState([
    {
      id: 'mod-1',
      title: 'Luxury 3-BR Balcony Suite in Gulshan',
      seller: 'Mahmudur Rahman',
      purpose: 'RENT',
      category: 'APARTMENT',
      price: '৳ 45,000 / mo',
      area: 'Gulshan-2',
      submittedAt: '22 Aug 2026, 09:15 AM',
      nidVerified: true,
    },
    {
      id: 'mod-2',
      title: '5-Katha Plot for Sale with Deed Papers',
      seller: 'Tanvir Hossain',
      purpose: 'SALE',
      category: 'LAND',
      price: '৳ 35,000,000',
      area: 'Dhanmondi',
      submittedAt: '22 Aug 2026, 11:40 AM',
      nidVerified: true,
    },
  ]);

  const handleModerateAd = (id: string, approve: boolean) => {
    setPendingListings((prev) => prev.filter((item) => item.id !== id));
  };

  return (
    <div className="bg-[#ffffff] min-h-screen text-[#111114]">
      <Header
        title="Ferio Platform Admin Control Plane"
        subtitle="SaaS Multi-Tenant Management, Database Provisioning & Global Marketplace Moderation (admin.ferio.com)"
        quickActionLabel="Provision Tenant DB"
        onQuickAction={() => setIsProvisioningModalOpen(true)}
      />

      <div className="p-8 max-w-7xl mx-auto space-y-8">
        {/* KPI Metrics */}
        <div className="grid grid-cols-4 gap-5">
          {platformStats.map((kpi) => (
            <div key={kpi.label} className="hairline-card space-y-2">
              <span className="eyebrow-label">{kpi.label}</span>
              <div className="text-2xl font-bold text-[#111114] tracking-tight">{kpi.value}</div>
              <div className="text-xs text-[#6e6e73]">{kpi.sub}</div>
            </div>
          ))}
        </div>

        {/* Tab Controls */}
        <div className="flex border-b border-[#e8e8ea] text-xs font-semibold">
          <button
            onClick={() => setActiveTab('ORGANIZATIONS')}
            className={`pb-3 px-4 transition-colors border-b-2 ${
              activeTab === 'ORGANIZATIONS' ? 'border-[#111114] text-[#111114]' : 'border-transparent text-[#6e6e73] hover:text-[#111114]'
            }`}
          >
            SaaS Organizations & Databases
          </button>
          <button
            onClick={() => setActiveTab('MARKETPLACE_MODERATION')}
            className={`pb-3 px-4 transition-colors border-b-2 flex items-center gap-2 ${
              activeTab === 'MARKETPLACE_MODERATION' ? 'border-[#111114] text-[#111114]' : 'border-transparent text-[#6e6e73] hover:text-[#111114]'
            }`}
          >
            Marketplace Moderation
            {pendingListings.length > 0 && (
              <span className="w-4 h-4 rounded-full bg-amber-600 text-white text-[10px] flex items-center justify-center font-bold">
                {pendingListings.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('INFRA_HEALTH')}
            className={`pb-3 px-4 transition-colors border-b-2 ${
              activeTab === 'INFRA_HEALTH' ? 'border-[#111114] text-[#111114]' : 'border-transparent text-[#6e6e73] hover:text-[#111114]'
            }`}
          >
            Control Plane Infrastructure
          </button>
        </div>

        {/* Tab 1: Organizations & DBs */}
        {activeTab === 'ORGANIZATIONS' && (
          <div className="hairline-card space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-[#111114]">Provisioned SaaS Organizations (Database-per-Tenant)</h2>
                <p className="text-xs text-[#6e6e73]">
                  Dynamic database isolation, connection pooling, and plan entitlement limits
                </p>
              </div>
              <button
                onClick={() => setIsProvisioningModalOpen(true)}
                className="btn-pill-primary text-xs py-1.5 px-3"
              >
                + Provision New SaaS Tenant
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#e8e8ea] text-[11px] font-semibold text-[#6e6e73] uppercase tracking-wider">
                    <th className="py-2.5 px-3">Organization</th>
                    <th className="py-2.5 px-3">Domain / Subdomain</th>
                    <th className="py-2.5 px-3">Plan Tier</th>
                    <th className="py-2.5 px-3">Database Target</th>
                    <th className="py-2.5 px-3">Units Quota Usage</th>
                    <th className="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e8e8ea] text-xs">
                  {organizations.map((org) => (
                    <tr key={org.id} className="hover:bg-[#fafafa] transition-colors">
                      <td className="py-3 px-3">
                        <div className="font-bold text-[#111114]">{org.name}</div>
                        <div className="text-[11px] text-[#6e6e73]">Created {org.createdAt}</div>
                      </td>
                      <td className="py-3 px-3 font-mono text-[11px] text-[#111114]">
                        {org.slug}.ferio.com
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-semibold text-[#111114]">{org.plan}</span>
                      </td>
                      <td className="py-3 px-3 font-mono text-[11px] text-[#6e6e73]">
                        {org.dbName}
                      </td>
                      <td className="py-3 px-3 text-[#111114]">
                        {org.unitsCount} / {org.unitsQuota} Units
                      </td>
                      <td className="py-3 px-3">
                        {org.status === 'ACTIVE' && (
                          <span className="status-pill status-pill-success">ACTIVE DB</span>
                        )}
                        {org.status === 'PROVISIONING' && (
                          <span className="status-pill status-pill-warning">MIGRATING DB...</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 2: Marketplace Moderation */}
        {activeTab === 'MARKETPLACE_MODERATION' && (
          <div className="hairline-card space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-[#111114]">Marketplace Property Ad Moderation Queue</h2>
              <p className="text-xs text-[#6e6e73]">
                Verify NID and Land Title Papers before publishing listings to ferio.com central search
              </p>
            </div>

            {pendingListings.length === 0 ? (
              <div className="py-12 text-center text-xs text-[#6e6e73]">
                All marketplace listing submissions have been reviewed.
              </div>
            ) : (
              <div className="space-y-3">
                {pendingListings.map((item) => (
                  <div key={item.id} className="p-4 rounded-[10px] border border-[#e8e8ea] bg-white flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-[#111114]">{item.title}</span>
                        <span className="status-pill status-pill-success">{item.purpose}</span>
                      </div>
                      <div className="text-xs text-[#6e6e73]">
                        Seller: <strong className="text-[#111114]">{item.seller}</strong> (NID Verified) • Submitted: {item.submittedAt}
                      </div>
                      <div className="font-semibold text-xs text-[#111114]">{item.price} — {item.area}</div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleModerateAd(item.id, false)}
                        className="btn-pill-secondary text-xs text-rose-600 border-rose-200 hover:bg-rose-50 py-1.5 px-3"
                      >
                        Reject
                      </button>
                      <button
                        onClick={() => handleModerateAd(item.id, true)}
                        className="btn-pill-primary text-xs bg-emerald-800 hover:bg-emerald-900 py-1.5 px-4"
                      >
                        Approve & Publish to Marketplace
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Infrastructure Health */}
        {activeTab === 'INFRA_HEALTH' && (
          <div className="hairline-card space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-[#111114]">Control Plane System Diagnostics</h2>
              <p className="text-xs text-[#6e6e73]">
                Real-time microservice queue status and Postgres connection pool telemetry
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-[10px] border border-[#e8e8ea] bg-[#fafafa] space-y-2">
                <span className="eyebrow-label">BullMQ Job Queues</span>
                <div className="text-xs text-[#111114] space-y-1">
                  <div className="flex justify-between"><span>Notification Queue:</span> <strong>Active (0 waiting)</strong></div>
                  <div className="flex justify-between"><span>Monthly Billing Scan:</span> <strong>Scheduled (Daily 00:00)</strong></div>
                  <div className="flex justify-between"><span>Lease Expiry Worker:</span> <strong>Active (0 waiting)</strong></div>
                </div>
              </div>

              <div className="p-4 rounded-[10px] border border-[#e8e8ea] bg-[#fafafa] space-y-2">
                <span className="eyebrow-label">PostgreSQL Database Pool</span>
                <div className="text-xs text-[#111114] space-y-1">
                  <div className="flex justify-between"><span>Control Plane Pool:</span> <strong>5 / 20 Connections</strong></div>
                  <div className="flex justify-between"><span>Tenant DB Pool:</span> <strong>18 Active Tenant DSNs</strong></div>
                  <div className="flex justify-between"><span>Redis Cache Hit Rate:</span> <strong>98.4%</strong></div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Provisioning Modal */}
      {isProvisioningModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[10px] max-w-md w-full p-6 space-y-5 border border-[#e8e8ea]">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-[#111114]">Provision SaaS Tenant Database</h3>
              <button onClick={() => setIsProvisioningModalOpen(false)} className="text-[#6e6e73] hover:text-[#111114]">
                ✕
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                setIsProvisioningModalOpen(false);
              }}
              className="space-y-4 text-xs"
            >
              <div>
                <label className="eyebrow-label block mb-1">Organization Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Uttara Property Management"
                  className="w-full p-2.5 bg-[#fafafa] border border-[#e8e8ea] rounded-[10px] text-[#111114]"
                />
              </div>

              <div>
                <label className="eyebrow-label block mb-1">Tenant Subdomain Slug</label>
                <div className="flex items-center">
                  <input
                    type="text"
                    required
                    placeholder="uttara"
                    className="w-full p-2.5 bg-[#fafafa] border border-[#e8e8ea] rounded-l-[10px] text-[#111114] font-mono"
                  />
                  <span className="bg-[#e8e8ea] px-3 py-2.5 text-xs text-[#6e6e73] rounded-r-[10px] font-mono border border-l-0 border-[#e8e8ea]">
                    .ferio.com
                  </span>
                </div>
              </div>

              <div>
                <label className="eyebrow-label block mb-1">Subscription Plan</label>
                <select className="w-full p-2.5 bg-[#fafafa] border border-[#e8e8ea] rounded-[10px] text-[#111114]">
                  <option value="STARTER">STARTER (5 Units)</option>
                  <option value="PRO">PRO (50 Units)</option>
                  <option value="BUSINESS">BUSINESS (500 Units)</option>
                  <option value="ENTERPRISE">ENTERPRISE (Custom)</option>
                </select>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsProvisioningModalOpen(false)}
                  className="btn-pill-secondary text-xs py-2 px-4"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-pill-primary text-xs py-2 px-4">
                  Run Database Migration & Provision
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
