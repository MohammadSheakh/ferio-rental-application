'use client';

import { useState } from 'react';
import { Header } from '@/components/Header';
import { Zap, Droplets, Flame, Gauge, Plus, Calculator, CheckCircle2, X } from 'lucide-react';

export default function UtilitiesPage() {
  const [isRecordReadingOpen, setIsRecordReadingOpen] = useState(false);

  const utilityAccounts = [
    {
      id: 'util-01',
      provider: 'DESCO (Dhaka Electric Supply)',
      type: 'ELECTRICITY',
      accountNo: 'DESCO-99881122',
      strategy: 'INDIVIDUAL_METER',
      metersCount: 24,
      lastBilledPeriod: 'August 2026',
      totalPeriodAmount: '৳ 64,500',
    },
    {
      id: 'util-02',
      provider: 'Dhaka WASA (Water & Sewerage)',
      type: 'WATER',
      accountNo: 'WASA-44556677',
      strategy: 'SHARED_METER',
      metersCount: 1,
      lastBilledPeriod: 'August 2026',
      totalPeriodAmount: '৳ 18,200',
    },
    {
      id: 'util-03',
      provider: 'Titas Gas Transmission',
      type: 'GAS',
      accountNo: 'TITAS-11223344',
      strategy: 'FIXED_CHARGE',
      metersCount: 24,
      lastBilledPeriod: 'August 2026',
      totalPeriodAmount: '৳ 25,920',
    },
  ];

  const [meterReadings, setMeterReadings] = useState([
    {
      unit: 'Rose Valley #A-1',
      meterNo: 'MTR-DESCO-001',
      previousReading: '1,240 kWh',
      currentReading: '1,410 kWh',
      consumption: '170 kWh',
      tariffRate: '৳ 8.50 / kWh',
      calculatedCharge: '৳ 1,445.00',
    },
    {
      unit: 'Rose Valley #A-2',
      meterNo: 'MTR-DESCO-002',
      previousReading: '2,150 kWh',
      currentReading: '2,380 kWh',
      consumption: '230 kWh',
      tariffRate: '৳ 8.50 / kWh',
      calculatedCharge: '৳ 1,955.00',
    },
  ]);

  return (
    <div>
      <Header
        title="Utilities, Metering & Bill Apportionment"
        subtitle="Manage DESCO, WASA & Titas Gas utility accounts, monthly meter readings, and floor area / equal split allocations"
        quickActionLabel="Record Meter Reading"
        onQuickAction={() => setIsRecordReadingOpen(true)}
      />

      <div className="p-8 space-y-8">
        {/* Utility Summary Cards */}
        <div className="grid grid-cols-3 gap-6">
          {utilityAccounts.map((acc) => (
            <div key={acc.id} className="hairline-card space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {acc.type === 'ELECTRICITY' && <Zap className="w-4 h-4 text-amber-500" />}
                  {acc.type === 'WATER' && <Droplets className="w-4 h-4 text-blue-500" />}
                  {acc.type === 'GAS' && <Flame className="w-4 h-4 text-orange-500" />}
                  <span className="font-bold text-sm text-[#111114]">{acc.type}</span>
                </div>
                <span className="status-pill status-pill-neutral font-mono text-[10px]">{acc.strategy}</span>
              </div>

              <div className="text-xs text-[#6e6e73]">
                <div>Provider: <strong className="text-[#111114]">{acc.provider}</strong></div>
                <div>Account #: <strong className="font-mono text-[#111114]">{acc.accountNo}</strong></div>
              </div>

              <div className="pt-3 border-t border-[#e8e8ea] flex justify-between items-center text-xs">
                <span className="text-[#6e6e73]">Aug Invoiced:</span>
                <span className="font-bold text-[#111114]">{acc.totalPeriodAmount}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Monthly Meter Readings Table */}
        <div className="hairline-card space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-[#111114]">Monthly Sub-Meter Readings & Apportionment</h2>
              <p className="text-xs text-[#6e6e73]">Recorded by Caretaker for August 2026 billing cycle</p>
            </div>
            <button className="btn-pill-primary text-xs py-1.5 px-3 gap-1">
              <Calculator className="w-3.5 h-3.5" /> Apportion WASA Water Bill
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#e8e8ea] text-[11px] font-semibold text-[#6e6e73] uppercase tracking-wider">
                  <th className="py-2.5 px-3">Unit</th>
                  <th className="py-2.5 px-3">Meter #</th>
                  <th className="py-2.5 px-3">Previous Reading</th>
                  <th className="py-2.5 px-3">Current Reading</th>
                  <th className="py-2.5 px-3">Consumption</th>
                  <th className="py-2.5 px-3">Tariff Rate</th>
                  <th className="py-2.5 px-3 text-right">Utility Charge BDT</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e8e8ea] text-xs">
                {meterReadings.map((r) => (
                  <tr key={r.meterNo} className="hover:bg-[#fafafa] transition-colors">
                    <td className="py-3 px-3 font-semibold text-[#111114]">{r.unit}</td>
                    <td className="py-3 px-3 font-mono text-[#6e6e73] text-[11px]">{r.meterNo}</td>
                    <td className="py-3 px-3 text-[#6e6e73]">{r.previousReading}</td>
                    <td className="py-3 px-3 font-medium text-[#111114]">{r.currentReading}</td>
                    <td className="py-3 px-3 font-bold text-amber-700">{r.consumption}</td>
                    <td className="py-3 px-3 text-[#6e6e73]">{r.tariffRate}</td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-[#111114]">{r.calculatedCharge}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Record Meter Reading Modal */}
      {isRecordReadingOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-5 border border-[#e8e8ea]">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-[#111114]">Record Sub-Meter Reading</h3>
              <button onClick={() => setIsRecordReadingOpen(false)} className="text-[#6e6e73] hover:text-[#111114]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form className="space-y-4 text-xs" onSubmit={(e) => { e.preventDefault(); setIsRecordReadingOpen(false); }}>
              <div>
                <label className="eyebrow-label block mb-1">Select Unit & Meter</label>
                <select className="w-full p-2.5 bg-[#fafafa] border border-[#e8e8ea] rounded-lg text-[#111114]">
                  <option>Rose Valley #A-1 (Meter: MTR-DESCO-001)</option>
                  <option>Rose Valley #A-2 (Meter: MTR-DESCO-002)</option>
                  <option>Rose Valley #A-3 (Meter: MTR-DESCO-003)</option>
                </select>
              </div>

              <div>
                <label className="eyebrow-label block mb-1">Current Meter Reading Value (kWh)</label>
                <input type="number" defaultValue={1650} className="w-full p-2.5 bg-[#fafafa] border border-[#e8e8ea] rounded-lg text-[#111114] font-bold" required />
              </div>

              <div>
                <label className="eyebrow-label block mb-1">Reading Notes / Photo Ref</label>
                <input type="text" placeholder="e.g. Caretaker monthly DESCO reading" className="w-full p-2.5 bg-[#fafafa] border border-[#e8e8ea] rounded-lg text-[#111114]" />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button type="button" onClick={() => setIsRecordReadingOpen(false)} className="btn-pill-secondary text-xs py-2 px-4">
                  Cancel
                </button>
                <button type="submit" className="btn-pill-primary text-xs py-2 px-5">
                  Save Reading
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
