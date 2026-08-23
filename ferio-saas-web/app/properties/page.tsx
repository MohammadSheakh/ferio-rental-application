'use client';

import { useCallback, useEffect, useState } from 'react';
import { Header } from '@/components/Header';
import {
  Building2,
  Plus,
  MapPin,
  X,
  Globe,
  GlobeLock,
  Users,
} from 'lucide-react';
import {
  listProperties,
  listUnits,
  createProperty,
  createUnit,
  type Property,
  type Unit,
} from '@/lib/api';

const PROPERTY_TYPES = [
  ['RESIDENTIAL_BUILDING', 'Residential Building'],
  ['INDIVIDUAL_APARTMENT', 'Individual Apartment'],
  ['COMMERCIAL_BUILDING', 'Commercial Building'],
  ['OFFICE', 'Office'],
  ['SHOP', 'Shop'],
  ['HOUSE', 'House'],
  ['WAREHOUSE', 'Warehouse'],
  ['MIXED_USE', 'Mixed Use'],
];

const UNIT_TYPES = [
  'APARTMENT',
  'SHOP',
  'OFFICE',
  'ROOM',
  'STORE_ROOM',
  'WAREHOUSE_UNIT',
  'COMMERCIAL_UNIT',
  'OTHER',
];

function statusPill(status: string) {
  if (status === 'AVAILABLE' || status === 'LISTED')
    return <span className="status-pill status-pill-success">{status.replaceAll('_', ' ')}</span>;
  if (status === 'MAINTENANCE_HOLD' || status === 'BLOCKED')
    return <span className="status-pill status-pill-error">{status.replaceAll('_', ' ')}</span>;
  if (status === 'DRAFT')
    return <span className="status-pill status-pill-warning">DRAFT</span>;
  return <span className="status-pill status-pill-neutral">{status.replaceAll('_', ' ')}</span>;
}

export default function PropertiesPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loadingProps, setLoadingProps] = useState(true);
  const [loadingUnits, setLoadingUnits] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [propertyModalOpen, setPropertyModalOpen] = useState(false);
  const [unitModalOpen, setUnitModalOpen] = useState(false);

  const loadProperties = useCallback(async () => {
    setLoadingProps(true);
    setError(null);
    try {
      const data = await listProperties();
      setProperties(data);
      setSelectedId((prev) => prev ?? data[0]?.id ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load properties');
    } finally {
      setLoadingProps(false);
    }
  }, []);

  useEffect(() => {
    void loadProperties();
  }, [loadProperties]);

  useEffect(() => {
    if (!selectedId) {
      setUnits([]);
      return;
    }
    let cancelled = false;
    setLoadingUnits(true);
    listUnits(selectedId)
      .then((data) => !cancelled && setUnits(data))
      .catch(() => !cancelled && setUnits([]))
      .finally(() => !cancelled && setLoadingUnits(false));
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const selected = properties.find((p) => p.id === selectedId);
  const occupied = units.filter(
    (u) => u.status === 'OCCUPIED' || u.status === 'NOTICE_GIVEN',
  ).length;
  const published = units.filter((u) => u.isPublished).length;

  return (
    <div>
      <Header
        title="Properties & Unit Inventory"
        subtitle="Buildings, floors and live unit states from your organization database"
        quickActionLabel="Add New Property"
        onQuickAction={() => setPropertyModalOpen(true)}
      />

      <div className="space-y-8 p-8">
        {/* ── Error / loading / empty ── */}
        {error && (
          <div className="rounded-[10px] border border-[#e8e8ea] bg-[#fafafa] p-4 text-xs text-[#111114]">
            Could not reach your workspace API. <span className="text-[#6e6e73]">{error}</span>
          </div>
        )}

        {/* ── Property cards ── */}
        {loadingProps ? (
          <div className="grid grid-cols-3 gap-6">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-36 animate-pulse rounded-[10px] bg-[#fafafa]" />
            ))}
          </div>
        ) : properties.length === 0 ? (
          <div className="rounded-[10px] border border-[#e8e8ea] p-10 text-center">
            <p className="text-sm text-[#111114]">No properties yet.</p>
            <p className="mt-1 text-xs text-[#6e6e73]">
              Add your first building to start managing units.
            </p>
            <button
              onClick={() => setPropertyModalOpen(true)}
              className="btn-pill-primary mt-5 text-xs"
            >
              Add New Property
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-6">
            {properties.map((prop) => {
              const isSelected = prop.id === selectedId;
              return (
                <button
                  key={prop.id}
                  onClick={() => setSelectedId(prop.id)}
                  className={`hairline-card cursor-pointer text-left transition-colors ${
                    isSelected ? 'border-[#111114]' : 'hover:border-slate-300'
                  }`}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#6e6e73]">
                      {prop.type.replaceAll('_', ' ').toLowerCase()}
                    </span>
                    <span className="status-pill status-pill-neutral">
                      {prop.status.toLowerCase()}
                    </span>
                  </div>

                  <h3 className="mt-1 text-base font-semibold tracking-tight text-[#111114]">
                    {prop.name}
                  </h3>
                  <div className="mt-1 flex items-center gap-1 text-xs text-[#6e6e73]">
                    <MapPin className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">
                      {[prop.address ?? prop.area, prop.district].filter(Boolean).join(', ') ||
                        'Location not set'}
                    </span>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-[#e8e8ea] pt-3 text-xs text-[#6e6e73]">
                    <span>
                      {prop._count?.units ?? prop.units?.length ?? 0} units ·{' '}
                      {prop._count?.buildings ?? prop.buildings?.length ?? 0} buildings
                    </span>
                    {(prop.ownership?.length ?? 0) > 0 && (
                      <Users className="h-3.5 w-3.5" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* ── Units of selected property ── */}
        {selected && (
          <div className="hairline-card space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-[#111114]">
                  Units — {selected.name}
                </h2>
                {!loadingUnits && units.length > 0 && (
                  <p className="mt-0.5 text-xs text-[#6e6e73]">
                    {occupied}/{units.length} occupied · {published} listed on marketplace
                  </p>
                )}
              </div>
              <button
                onClick={() => setUnitModalOpen(true)}
                className="btn-pill-primary py-1.5 px-3 text-xs"
              >
                + Add Unit
              </button>
            </div>

            {loadingUnits ? (
              <div className="grid grid-cols-3 gap-4">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-32 animate-pulse rounded-lg bg-[#fafafa]" />
                ))}
              </div>
            ) : units.length === 0 ? (
              <div className="rounded-[10px] border border-[#e8e8ea] p-8 text-center">
                <p className="text-xs text-[#111114]">No units in this property yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-4">
                {units.map((unit) => (
                  <div
                    key={unit.id}
                    className="space-y-3 rounded-[10px] border border-[#e8e8ea] bg-white p-4"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-[#111114]">{unit.name}</span>
                      {statusPill(unit.status)}
                    </div>

                    <div className="space-y-1 text-xs text-[#6e6e73]">
                      <div>
                        Type:{' '}
                        <strong className="text-[#111114]">
                          {unit.type.replaceAll('_', ' ').toLowerCase()}
                        </strong>
                      </div>
                      {unit.areaSqFt && (
                        <div>
                          Area:{' '}
                          <strong className="text-[#111114]">
                            {unit.areaSqFt.toLocaleString()} sq ft
                          </strong>
                          {unit.floor !== null ? ` · Floor ${unit.floor}` : ''}
                        </div>
                      )}
                      {unit.ownership && unit.ownership.length > 0 && (
                        <div>
                          Owners:{' '}
                          <strong className="text-[#111114]">
                            {unit.ownership
                              .map((o) => `${o.ownerName} ${o.sharePercent}%`)
                              .join(', ')}
                          </strong>
                        </div>
                      )}
                      {unit.leases?.some((l) => l.status === 'ACTIVE') && (
                        <div className="text-emerald-700">
                          Renter:{' '}
                          <strong>
                            {unit.leases.find((l) => l.status === 'ACTIVE')?.renter?.name}
                          </strong>
                        </div>
                      )}
                    </div>

                    <div className="flex justify-end gap-3 border-t border-[#e8e8ea] pt-2">
                      {unit.isPublished && unit.marketplaceListingId ? (
                        <a
                          href={`http://localhost:3001/listings/${unit.marketplaceListingId}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 text-xs font-medium text-[#6e6e73] underline hover:text-[#111114]"
                        >
                          <Globe className="h-3 w-3" /> View listing
                        </a>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Create property modal (real POST) ── */}
      {propertyModalOpen && (
        <PropertyModal
          onClose={() => setPropertyModalOpen(false)}
          onCreated={() => {
            setPropertyModalOpen(false);
            void loadProperties();
          }}
        />
      )}

      {/* ── Create unit modal (real POST) ── */}
      {unitModalOpen && selected && (
        <UnitModal
          property={selected}
          onClose={() => setUnitModalOpen(false)}
          onCreated={() => {
            setUnitModalOpen(false);
            void loadProperties();
            listUnits(selected.id).then(setUnits).catch(() => {});
          }}
        />
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Modals
// ────────────────────────────────────────────────────────────

function PropertyModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setSaving(true);
    setFormError(null);
    try {
      await createProperty({
        name: String(f.get('name')),
        type: String(f.get('type')),
        address: String(f.get('address')) || undefined,
        area: String(f.get('area')) || undefined,
        district: String(f.get('district')) || undefined,
      });
      onCreated();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not create property');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md space-y-5 rounded-[10px] border border-[#e8e8ea] bg-white p-6">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-[#111114]">Add New Property</h3>
          <button onClick={onClose} className="text-[#6e6e73] hover:text-[#111114]">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form className="space-y-4 text-xs" onSubmit={submit}>
          <div>
            <label className="eyebrow-label mb-1 block">Name</label>
            <input
              name="name"
              required
              placeholder="e.g. Rose Valley Heights"
              className="w-full rounded-[10px] border border-[#e8e8ea] bg-[#fafafa] p-2.5 text-[#111114]"
            />
          </div>

          <div>
            <label className="eyebrow-label mb-1 block">Type</label>
            <select
              name="type"
              required
              defaultValue="RESIDENTIAL_BUILDING"
              className="w-full rounded-[10px] border border-[#e8e8ea] bg-[#fafafa] p-2.5 capitalize text-[#111114]"
            >
              {PROPERTY_TYPES.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="eyebrow-label mb-1 block">Area</label>
              <input
                name="area"
                placeholder="Banani"
                className="w-full rounded-[10px] border border-[#e8e8ea] bg-[#fafafa] p-2.5 text-[#111114]"
              />
            </div>
            <div>
              <label className="eyebrow-label mb-1 block">District</label>
              <input
                name="district"
                defaultValue="Dhaka"
                className="w-full rounded-[10px] border border-[#e8e8ea] bg-[#fafafa] p-2.5 text-[#111114]"
              />
            </div>
          </div>

          <div>
            <label className="eyebrow-label mb-1 block">Street Address</label>
            <textarea
              name="address"
              rows={2}
              placeholder="House, Road, Block…"
              className="w-full rounded-[10px] border border-[#e8e8ea] bg-[#fafafa] p-2.5 text-[#111114]"
            />
          </div>

          {formError && <p className="text-[11px] text-rose-700">{formError}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-pill-secondary py-2 px-4 text-xs">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn-pill-primary py-2 px-4 text-xs disabled:opacity-50">
              {saving ? 'Creating…' : 'Create Property'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function UnitModal({
  property,
  onClose,
  onCreated,
}: {
  property: Property;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setSaving(true);
    setFormError(null);
    try {
      await createUnit({
        propertyId: property.id,
        name: String(f.get('name')),
        type: String(f.get('type')),
        floor: f.get('floor') ? Number(f.get('floor')) : undefined,
        bedrooms: f.get('bedrooms') ? Number(f.get('bedrooms')) : undefined,
        bathrooms: f.get('bathrooms') ? Number(f.get('bathrooms')) : undefined,
        areaSqFt: f.get('areaSqFt') ? Number(f.get('areaSqFt')) : undefined,
      });
      onCreated();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not create unit');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md space-y-5 rounded-[10px] border border-[#e8e8ea] bg-white p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-[#111114]">Add Unit</h3>
            <p className="text-xs text-[#6e6e73]">{property.name}</p>
          </div>
          <button onClick={onClose} className="text-[#6e6e73] hover:text-[#111114]">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form className="space-y-4 text-xs" onSubmit={submit}>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="eyebrow-label mb-1 block">Unit name</label>
              <input
                name="name"
                required
                placeholder="A-4 / Shop #3"
                className="w-full rounded-[10px] border border-[#e8e8ea] bg-[#fafafa] p-2.5 text-[#111114]"
              />
            </div>
            <div>
              <label className="eyebrow-label mb-1 block">Type</label>
              <select
                name="type"
                defaultValue="APARTMENT"
                className="w-full rounded-[10px] border border-[#e8e8ea] bg-[#fafafa] p-2.5 capitalize text-[#111114]"
              >
                {UNIT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t.replaceAll('_', ' ').toLowerCase()}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="eyebrow-label mb-1 block">Floor</label>
              <input name="floor" inputMode="numeric" className="w-full rounded-[10px] border border-[#e8e8ea] bg-[#fafafa] p-2.5 text-[#111114]" />
            </div>
            <div>
              <label className="eyebrow-label mb-1 block">Beds</label>
              <input name="bedrooms" inputMode="numeric" className="w-full rounded-[10px] border border-[#e8e8ea] bg-[#fafafa] p-2.5 text-[#111114]" />
            </div>
            <div>
              <label className="eyebrow-label mb-1 block">Baths</label>
              <input name="bathrooms" inputMode="numeric" className="w-full rounded-[10px] border border-[#e8e8ea] bg-[#fafafa] p-2.5 text-[#111114]" />
            </div>
          </div>

          <div>
            <label className="eyebrow-label mb-1 block">Area (sq ft)</label>
            <input name="areaSqFt" inputMode="numeric" className="w-full rounded-[10px] border border-[#e8e8ea] bg-[#fafafa] p-2.5 text-[#111114]" />
          </div>

          {formError && <p className="text-[11px] text-rose-700">{formError}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-pill-secondary py-2 px-4 text-xs">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn-pill-primary py-2 px-4 text-xs disabled:opacity-50">
              {saving ? 'Adding…' : 'Add Unit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
