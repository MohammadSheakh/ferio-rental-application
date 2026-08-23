'use client';

import { Search, Bell, Plus } from 'lucide-react';

interface HeaderProps {
  title: string;
  subtitle?: string;
  onQuickAction?: () => void;
  quickActionLabel?: string;
}

export function Header({ title, subtitle, onQuickAction, quickActionLabel }: HeaderProps) {
  return (
    <header className="h-16 border-b border-[#e8e8ea] bg-white px-8 flex items-center justify-between sticky top-0 z-10">
      <div>
        <h1 className="text-lg font-semibold text-[#111114] tracking-tight">{title}</h1>
        {subtitle && <p className="text-xs text-[#6e6e73]">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-4">
        {/* Global Search input */}
        <div className="relative w-64">
          <Search className="w-4 h-4 text-[#6e6e73] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search properties, tenants, leases..."
            className="w-full pl-9 pr-4 py-1.5 bg-[#fafafa] border border-[#e8e8ea] rounded-full text-xs text-[#111114] focus:outline-none focus:border-[#111114] transition-colors"
          />
        </div>

        {/* Notifications */}
        <button className="w-8 h-8 rounded-full border border-[#e8e8ea] bg-white flex items-center justify-center text-[#6e6e73] hover:text-[#111114] hover:bg-[#fafafa] transition-colors relative">
          <Bell className="w-4 h-4" />
          <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-emerald-500"></span>
        </button>

        {/* Primary Action Button if passed */}
        {quickActionLabel && (
          <button onClick={onQuickAction} className="btn-pill-primary text-xs gap-1.5 py-1.5 px-4">
            <Plus className="w-3.5 h-3.5" />
            {quickActionLabel}
          </button>
        )}
      </div>
    </header>
  );
}
