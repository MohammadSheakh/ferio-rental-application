'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Building2,
  FileText,
  CreditCard,
  Zap,
  ClipboardCheck,
  Receipt,
  Users,
  Wrench,
  LayoutDashboard,
  Building,
  UserCheck,
  TrendingUp,
  ChevronDown,
  Shield,
} from 'lucide-react';
import {
  fetchMyOrganizations,
  getActiveTenantSlug,
  setActiveTenantSlug,
  type MyOrganization,
} from '@/lib/api';

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [orgs, setOrgs] = useState<MyOrganization[]>([]);
  const [activeSlug, setActive] = useState<string>('');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setActive(getActiveTenantSlug());
    void fetchMyOrganizations().then(setOrgs);
  }, []);

  const current = orgs.find((o) => o.slug === activeSlug);

  function select(slug: string) {
    setActiveTenantSlug(slug);
    setActive(slug);
    setOpen(false);
    router.refresh();
  }

  const adminNavItems = [
    { href: '/', label: 'Overview', icon: LayoutDashboard },
    { href: '/properties', label: 'Properties & Units', icon: Building2 },
    { href: '/leases', label: 'Leases & Occupancy', icon: FileText },
    { href: '/billing', label: 'Billing & Ledger', icon: CreditCard },
    { href: '/utilities', label: 'Utilities & Metering', icon: Zap },
    { href: '/inspections', label: 'Inspections & Audits', icon: ClipboardCheck },
    { href: '/expenses', label: 'Expenses & Deductions', icon: Receipt },
    { href: '/crm', label: 'Leads & Screening', icon: Users },
    { href: '/maintenance', label: 'Maintenance & Vendors', icon: Wrench },
  ];

  const portalNavItems = [
    { href: '/search', label: 'Public Marketplace (ferio.com)', icon: Building },
    { href: '/tenant', label: 'Tenant Portal View', icon: UserCheck },
    { href: '/owner', label: 'Owner Yield Portal View', icon: TrendingUp },
    { href: '/admin', label: 'Platform Control Plane (admin.ferio.com)', icon: Shield },
  ];

  return (
    <aside className="w-64 border-r border-[#e8e8ea] bg-white flex flex-col justify-between h-screen sticky top-0">
      <div>
        {/* Brand & Organization Selector */}
        <div className="p-5 border-b border-[#e8e8ea]">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 bg-[#111114] text-white rounded-full flex items-center justify-center font-bold text-sm">
              F
            </div>
            <span className="font-semibold text-base tracking-tight text-[#111114]">
              Ferio Rental
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-widest px-1.5 py-0.5 bg-[#fafafa] border border-[#e8e8ea] text-[#6e6e73] rounded-full">
              BD
            </span>
          </div>

          {/* Org Selector — memberships of the signed-in identity */}
          <div className="relative">
            <button
              onClick={() => setOpen((v) => !v)}
              className="flex w-full items-center justify-between p-2.5 rounded-lg border border-[#e8e8ea] bg-[#fafafa] text-xs font-medium cursor-pointer hover:bg-slate-100 transition-colors"
            >
              <span className="flex items-center gap-2 overflow-hidden">
                <Building className="w-4 h-4 text-[#6e6e73] shrink-0" />
                <span className="truncate text-[#111114] font-medium">
                  {current?.name ?? 'Select organization'}
                </span>
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-[#6e6e73] shrink-0" />
            </button>

            {open && (
              <div className="absolute z-40 mt-1 w-full rounded-[10px] border border-[#e8e8ea] bg-white shadow-none overflow-hidden">
                {orgs.length === 0 ? (
                  <p className="px-3 py-3 text-[11px] text-[#6e6e73]">
                    No memberships. Sign in or ask an owner to invite you.
                  </p>
                ) : (
                  orgs.map((o) => (
                    <button
                      key={o.organizationId}
                      onClick={() => select(o.slug)}
                      className={`flex w-full items-center justify-between px-3 py-2.5 text-left text-xs transition-colors ${
                        o.slug === activeSlug
                          ? 'bg-[#111114] text-white'
                          : 'text-[#111114] hover:bg-[#fafafa]'
                      }`}
                    >
                      <span className="truncate">{o.name}</span>
                      <span
                        className={`ml-2 shrink-0 text-[10px] uppercase tracking-widest ${
                          o.slug === activeSlug ? 'text-white/70' : 'text-[#6e6e73]'
                        }`}
                      >
                        {o.memberRole.replaceAll('_', ' ').toLowerCase()}
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* Navigation Section */}
        <nav className="p-3 space-y-4 overflow-y-auto max-h-[calc(100vh-140px)]">
          <div className="space-y-1">
            <div className="px-3 py-1 eyebrow-label">SaaS Operational App</div>
            {adminNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-[#111114] text-white font-semibold'
                      : 'text-[#6e6e73] hover:bg-[#fafafa] hover:text-[#111114]'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-[#6e6e73]'}`} />
                  {item.label}
                </Link>
              );
            })}
          </div>

          <div className="space-y-1 pt-2 border-t border-[#e8e8ea]">
            <div className="px-3 py-1 eyebrow-label">Platform Core Applications</div>
            {portalNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-[#111114] text-white font-semibold'
                      : 'text-[#6e6e73] hover:bg-[#fafafa] hover:text-[#111114]'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-[#6e6e73]'}`} />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>
      </div>

      {/* Footer Profile Snippet */}
      <div className="p-4 border-t border-[#e8e8ea]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-slate-200 text-[#111114] font-semibold text-xs flex items-center justify-center">
            MS
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-semibold text-[#111114] truncate">Mohammad Sheakh</span>
            <span className="text-[11px] text-[#6e6e73] truncate">Platform Administrator</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
