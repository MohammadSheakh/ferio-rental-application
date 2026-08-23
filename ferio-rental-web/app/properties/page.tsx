'use client';

import { useState } from 'react';
import { Header } from '@/components/Header';
import { Building2, Plus, Home, MapPin, Layers, CheckCircle2, Clock, AlertTriangle, X } from 'lucide-react';

export default function PropertiesPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPropertyId, setSelectedPropertyId] = useState('prop-1');

  const properties = [
    {
      id: 'prop-1',
      code: 'PROP-RVH',
      name: 'Rose Valley Heights',
      type: 'RESIDENTIAL_BUILDING',
      address: 'House 42, Road 11, Block D, Banani',
      area: 'Banani',
      district: 'Dhaka',
      totalUnits: 24,
      occupiedUnits: 22,
      marketRentRange: '৳ 35,000 – ৳ 55,000',
    },
    {
      id: 'prop-2',
      code: 'PROP-BNT',
      name: 'Banani Commercial Tower',
      type: 'COMMERCIAL_BUILDING',
      address: 'Plot 18, Kemal Ataturk Avenue',
      area: 'Banani',
      district: 'Dhaka',
      totalUnits: 12,
      occupiedUnits: 11,
      marketRentRange: '৳ 80,000 – ৳ 150,000',
    },
    {
      id: 'prop-3',
      code: 'PROP-GLS',
      name: 'Gulshan Garden Residency',
      type: 'RESIDENTIAL_BUILDING',
      address: 'Road 71, Gulshan-2',
      area: 'Gulshan',
      district: 'Dhaka',
      totalUnits: 15,
      occupiedUnits: 15,
      marketRentRange: '৳ 65,000 – ৳ 110,000',
    },
  ];

  const unitsMap: Record<string, Array<{ number: string; floor: number; type: string; area: number; rent: string; status: 'AVAILABLE' | 'OCCUPIED' | 'MAINTENANCE_HOLD' | 'RESERVED' }>> = {
    'prop-1': [
      { number: 'A-1', floor: 1, type: '2 Bed Apartment', area: 1250, rent: '৳ 35,000', status: 'OCCUPIED' },
      { number: 'A-2', floor: 1, type: '2 Bed Apartment', area: 1250, rent: '৳ 35,000', status: 'MAINTENANCE_HOLD' },
      { number: 'A-3', floor: 1, type: '3 Bed Apartment', area: 1600, rent: '৳ 45,000', status: 'OCCUPIED' },
      { number: 'A-4', floor: 1, type: '3 Bed Apartment', area: 1650, rent: '৳ 48,000', status: 'AVAILABLE' },
      { number: 'B-1', floor: 2, type: '3 Bed Apartment', area: 1650, rent: '৳ 48,000', status: 'OCCUPIED' },
      { number: 'B-2', floor: 2, type: '3 Bed Apartment', area: 1650, rent: '৳ 48,000', status: 'RESERVED' },
    ],
    'prop-2': [
      { number: 'Floor 2 Office', floor: 2, type: 'Commercial Space', area: 2400, rent: '৳ 120,000', status: 'OCCUPIED' },
      { number: 'Floor 3 Office', floor: 3, type: 'Commercial Space', area: 2400, rent: '৳ 120,000', status: 'AVAILABLE' },
    ],
    'prop-3': [
      { number: '4-C', floor: 4, type: '3 Bed Luxury Suite', area: 2200, rent: '৳ 85,000', status: 'OCCUPIED' },
      { number: '5-A', floor: 5, type: '3 Bed Luxury Suite', area: 2200, rent: '৳ 90,000', status: 'OCCUPIED' },
    ],
  };

  const selectedUnits = unitsMap[selectedPropertyId] || [];

  return (
    <div>
      <Header
        title="Properties & Unit Inventory"
        subtitle="Manage building portfolios, floors, and real-time unit status state machine"
        quickActionLabel="Add New Property"
        onQuickAction={() => setIsModalOpen(true)}
      />

      <div className="p-8 space-y-8">
        {/* Properties Cards Grid */}
        <div className="grid grid-cols-3 gap-6">
          {properties.map((prop) => {
            const isSelected = prop.id === selectedPropertyId;
            const occupancyPct = Math.round((prop.occupiedUnits / prop.totalUnits) * 100);

            return (
              <div
                key={prop.id}
                onClick={() => setSelectedPropertyId(prop.id)}
                className={`hairline-card cursor-pointer transition-all ${
                  isSelected ? 'border-[#111114] bg-[#fafafa]' : 'hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-full bg-[#111114] text-white">
                    {prop.code}
                  </span>
                  <span className="status-pill status-pill-success">
                    {occupancyPct}% Occupied
                  </span>
                </div>

                <h3 className="text-base font-semibold text-[#111114] mt-1">{prop.name}</h3>
                <div className="flex items-center gap-1 text-xs text-[#6e6e73] mt-1">
                  <MapPin className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{prop.address}</span>
                </div>

                <div className="mt-4 pt-3 border-t border-[#e8e8ea] flex items-center justify-between text-xs text-[#6e6e73]">
                  <span>{prop.totalUnits} Total Units</span>
                  <span className="font-semibold text-[#111114]">{prop.marketRentRange}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Selected Property Units Inventory Table */}
        <div className="hairline-card space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-[#111114]">Unit Inventory & Status State Machine</h2>
              <p className="text-xs text-[#6e6e73]">
                Showing units for {properties.find((p) => p.id === selectedPropertyId)?.name}
              </p>
            </div>
            <button className="btn-pill-primary text-xs py-1.5 px-3">
              + Add Unit to Property
            </button>
          </div>

          <div className="grid grid-cols-3 gap-4 pt-2">
            {selectedUnits.map((unit) => (
              <div key={unit.number} className="p-4 rounded-lg border border-[#e8e8ea] bg-white space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-[#111114]">Unit {unit.number}</span>
                  {unit.status === 'AVAILABLE' && (
                    <span className="status-pill status-pill-success">AVAILABLE</span>
                  )}
                  {unit.status === 'OCCUPIED' && (
                    <span className="status-pill status-pill-neutral">OCCUPIED</span>
                  )}
                  {unit.status === 'MAINTENANCE_HOLD' && (
                    <span className="status-pill status-pill-error">MAINTENANCE HOLD</span>
                  )}
                  {unit.status === 'RESERVED' && (
                    <span className="status-pill status-pill-warning">RESERVED</span>
                  )}
                </div>

                <div className="text-xs text-[#6e6e73] space-y-1">
                  <div>Type: <strong className="text-[#111114]">{unit.type}</strong></div>
                  <div>Area: <strong className="text-[#111114]">{unit.area} sq ft</strong> (Floor {unit.floor})</div>
                  <div>Market Rent: <strong className="text-[#111114]">{unit.rent} / mo</strong></div>
                </div>

                <div className="pt-2 border-t border-[#e8e8ea] flex justify-end">
                  <button className="text-xs text-[#6e6e73] hover:text-[#111114] font-medium underline">
                    Update Status
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Property Creation Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-5 border border-[#e8e8ea]">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-[#111114]">Add New Rental Property</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-[#6e6e73] hover:text-[#111114]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form className="space-y-4 text-xs" onSubmit={(e) => { e.preventDefault(); setIsModalOpen(false); }}>
              <div>
                <label className="eyebrow-label block mb-1">Property Name</label>
                <input type="text" placeholder="e.g. Banani Heights" className="w-full p-2.5 bg-[#fafafa] border border-[#e8e8ea] rounded-lg text-[#111114]" required />
              </div>

              <div>
                <label className="eyebrow-label block mb-1">Property Code</label>
                <input type="text" placeholder="e.g. PROP-BNH" className="w-full p-2.5 bg-[#fafafa] border border-[#e8e8ea] rounded-lg text-[#111114]" required />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="eyebrow-label block mb-1">Area</label>
                  <input type="text" placeholder="Banani" className="w-full p-2.5 bg-[#fafafa] border border-[#e8e8ea] rounded-lg text-[#111114]" required />
                </div>
                <div>
                  <label className="eyebrow-label block mb-1">District</label>
                  <input type="text" placeholder="Dhaka" className="w-full p-2.5 bg-[#fafafa] border border-[#e8e8ea] rounded-lg text-[#111114]" required />
                </div>
              </div>

              <div>
                <label className="eyebrow-label block mb-1">Street Address</label>
                <textarea rows={2} placeholder="House, Road, Block..." className="w-full p-2.5 bg-[#fafafa] border border-[#e8e8ea] rounded-lg text-[#111114]"></textarea>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn-pill-secondary text-xs py-2 px-4">
                  Cancel
                </button>
                <button type="submit" className="btn-pill-primary text-xs py-2 px-4">
                  Create Property
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
