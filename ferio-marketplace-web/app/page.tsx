'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Search, MapPin, X, Plus, ChevronLeft, ChevronRight, Star } from 'lucide-react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import {
  searchListings,
  mapSearch,
  ensureMyAccount,
  createInquiry,
  getSpotlight,
  type ListingCard,
  type MapMarker,
  type SearchParams,
  type SpotlightItem,
} from '@/lib/api';
import { useAuth } from '@/lib/auth';

const FerioMap = dynamic(() => import('@/components/FerioMap'), {
  ssr: false,
  loading: () => (
    <div className="h-[480px] w-full rounded-[10px] border border-[#e8e8ea] bg-[#fafafa]" />
  ),
});

const ASSET_TYPES = [
  { id: '', label: 'All Categories' },
  { id: 'APARTMENT', label: 'Apartments' },
  { id: 'HOUSE', label: 'Houses' },
  { id: 'SHOP', label: 'Shops & Commercial' },
  { id: 'OFFICE', label: 'Offices' },
  { id: 'LAND', label: 'Land & Plots' },
  { id: 'STORE_ROOM', label: 'Store Rooms' },
  { id: 'WAREHOUSE', label: 'Warehouses' },
];

const DHAKA_CENTER: [number, number] = [23.7806, 90.4074];

function formatPrice(price: number, rentFrequency?: string | null) {
  const amount = `৳ ${price.toLocaleString('en-US')}`;
  if (rentFrequency === 'MONTHLY') return `${amount}/mo`;
  if (rentFrequency === 'QUARTERLY') return `${amount}/qtr`;
  if (rentFrequency === 'YEARLY') return `${amount}/yr`;
  return amount;
}

export default function MarketplacePage() {
  const auth = useAuth();
  const [purpose, setPurpose] = useState<'' | 'RENT' | 'SALE'>('');
  const [assetType, setAssetType] = useState('');
  const [areaQuery, setAreaQuery] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [bedrooms, setBedrooms] = useState('');
  const [page, setPage] = useState(1);

  const [view, setView] = useState<'list' | 'map'>('list');
  const [markers, setMarkers] = useState<MapMarker[]>([]);
  const [markerCount, setMarkerCount] = useState<number | null>(null);
  const boundsRef = useRef({ ...{} as Record<string, number> });

  const [items, setItems] = useState<ListingCard[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 24, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [spotlight, setSpotlight] = useState<SpotlightItem[]>([]);

  useEffect(() => {
    getSpotlight(6)
      .then((res) => setSpotlight(res.items ?? []))
      .catch(() => setSpotlight([]));
  }, []);

  const params: SearchParams = {
    purpose: purpose || undefined,
    assetType: assetType || undefined,
    area: areaQuery || undefined,
    minPrice: minPrice ? Number(minPrice) : undefined,
    maxPrice: maxPrice ? Number(maxPrice) : undefined,
    bedrooms: bedrooms ? Number(bedrooms) : undefined,
    page,
    limit: 24,
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    searchListings(params)
      .then((res) => {
        if (cancelled) return;
        setItems(res.items);
        setMeta(res.meta);
      })
      .catch(() => !cancelled && setError(true))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [purpose, assetType, areaQuery, minPrice, maxPrice, bedrooms, page]);

  const refreshMarkers = useCallback(async () => {
    const b = boundsRef.current;
    if (!b.minLat) return;
    try {
      const res = await mapSearch({
        minLat: b.minLat,
        maxLat: b.maxLat,
        minLng: b.minLng,
        maxLng: b.maxLng,
        purpose: purpose || undefined,
        assetType: assetType || undefined,
      });
      setMarkers(res.markers);
      setMarkerCount(res.meta.count);
    } catch {
      /* markers are best-effort */
    }
  }, [purpose, assetType]);

  const handleBounds = useCallback(
    (b: { minLat: number; maxLat: number; minLng: number; maxLng: number }) => {
      boundsRef.current = b;
      void refreshMarkers();
    },
    [refreshMarkers],
  );

  const hasFilters = purpose || assetType || areaQuery || minPrice || maxPrice || bedrooms;

  return (
    <div className="min-h-screen bg-white text-[#111114]">
      {/* ── Header ── */}
      <header className="sticky top-0 z-30 border-b border-[#e8e8ea] bg-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#111114] text-sm font-bold text-white">
              F
            </div>
            <span className="text-base font-semibold tracking-tight">Ferio</span>
          </Link>
          <nav className="hidden items-center gap-6 text-sm text-[#6e6e73] md:flex">
            <button
              onClick={() => { setPurpose('SALE'); setPage(1); }}
              className={`transition-colors hover:text-[#111114] ${purpose === 'SALE' ? 'font-medium text-[#111114]' : ''}`}
            >
              Buy
            </button>
            <button
              onClick={() => { setPurpose('RENT'); setPage(1); }}
              className={`transition-colors hover:text-[#111114] ${purpose === 'RENT' ? 'font-medium text-[#111114]' : ''}`}
            >
              Rent
            </button>
            <button onClick={() => { setAssetType('OFFICE'); setPage(1); }} className="transition-colors hover:text-[#111114]">
              Commercial
            </button>
            <button onClick={() => { setAssetType('LAND'); setPage(1); }} className="transition-colors hover:text-[#111114]">
              Land
            </button>
          </nav>
          <div className="flex items-center gap-3">
            {auth.ready && auth.token ? (
              <>
                <Link href="/renter" className="hidden text-xs font-medium text-[#111114] underline-offset-2 hover:underline sm:inline">
                  My Rental
                </Link>
                <button onClick={auth.logout} className="text-xs text-[#6e6e73] underline hover:text-[#111114]">
                  Log out
                </button>
              </>
            ) : (
              <Link href="/login" className="btn-pill-secondary py-2 text-xs">
                Log in
              </Link>
            )}
            <Link
              href={auth.token ? '/post' : '/login'}
              className="btn-pill-primary flex items-center gap-1.5 py-2 text-xs"
            >
              <Plus className="h-3.5 w-3.5" /> Post Property
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-10 px-6 py-12 lg:px-8">
        {/* ── Hero ── */}
        <section className="max-w-3xl space-y-3">
          <p className="eyebrow-label">Bangladesh Property Marketplace</p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Find your next home, shop or plot.
          </h1>
          <p className="text-sm leading-relaxed text-[#6e6e73]">
            Every listing is mapped with OpenStreetMap coordinates across Dhaka.
            Contact owners directly — no middlemen.
          </p>
        </section>

        {/* ── §23 Spotlight (paid TOP_SEARCH promotions) ── */}
        {spotlight.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-baseline justify-between">
              <h2 className="eyebrow-label flex items-center gap-1.5">
                <Star className="h-3 w-3" /> Featured this week
              </h2>
              <span className="text-[11px] text-[#6e6e73]">Paid promotion</span>
            </div>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
              {spotlight.slice(0, 3).map((s) => (
                <Link key={s.id} href={`/listings/${s.id}`} className="group block">
                  <div className="relative mb-2 h-36 w-full overflow-hidden rounded-[10px] bg-[#fafafa]">
                    {s.coverImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={s.coverImageUrl}
                        alt={s.title}
                        className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-[#6e6e73]">No photo</div>
                    )}
                    <span className="absolute left-2 top-2 rounded-full bg-[#111114] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                      Spotlight
                    </span>
                  </div>
                  <h3 className="line-clamp-1 text-sm font-medium">{s.title}</h3>
                  <p className="text-xs text-[#6e6e73]">
                    {formatPrice(s.price, s.purpose === 'RENT' ? 'MONTHLY' : null)}
                    {s.area ? ` · ${s.area}` : ''}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* ── Search bar ── */}
        <section className="space-y-4 rounded-[10px] border border-[#e8e8ea] p-5">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[240px] flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6e6e73]" />
              <input
                value={areaQuery}
                onChange={(e) => { setAreaQuery(e.target.value); setPage(1); }}
                placeholder="Search area — Rampura, Gulshan, Dhanmondi…"
                className="w-full rounded-[10px] border border-[#e8e8ea] bg-[#fafafa] py-2 pl-10 pr-4 text-sm outline-none transition-colors placeholder:text-[#6e6e73]/70 focus:border-[#111114]"
              />
            </div>

            <div className="flex items-center gap-0.5 rounded-full border border-[#e8e8ea] bg-[#fafafa] p-1">
              {([
                ['', 'All'],
                ['RENT', 'Rent'],
                ['SALE', 'Sale'],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => { setPurpose(value as '' | 'RENT' | 'SALE'); setPage(1); }}
                  className={`rounded-full px-4 py-1.5 text-sm transition-colors ${
                    purpose === value ? 'bg-[#111114] text-white' : 'text-[#6e6e73] hover:text-[#111114]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <input
              value={minPrice}
              onChange={(e) => { setMinPrice(e.target.value.replace(/\D/g, '')); setPage(1); }}
              placeholder="Min ৳"
              inputMode="numeric"
              className="w-24 rounded-[10px] border border-[#e8e8ea] bg-[#fafafa] px-3 py-2 text-sm outline-none focus:border-[#111114]"
            />
            <input
              value={maxPrice}
              onChange={(e) => { setMaxPrice(e.target.value.replace(/\D/g, '')); setPage(1); }}
              placeholder="Max ৳"
              inputMode="numeric"
              className="w-24 rounded-[10px] border border-[#e8e8ea] bg-[#fafafa] px-3 py-2 text-sm outline-none focus:border-[#111114]"
            />
            <select
              value={bedrooms}
              onChange={(e) => { setBedrooms(e.target.value); setPage(1); }}
              className="rounded-[10px] border border-[#e8e8ea] bg-[#fafafa] px-3 py-2 text-sm text-[#111114] outline-none focus:border-[#111114]"
            >
              <option value="">Beds</option>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>{n}+</option>
              ))}
            </select>

            <div className="ml-auto flex items-center gap-0.5 rounded-full border border-[#e8e8ea] bg-[#fafafa] p-1">
              <button
                onClick={() => setView('list')}
                className={`rounded-full px-4 py-1.5 text-sm transition-colors ${
                  view === 'list' ? 'bg-[#111114] text-white' : 'text-[#6e6e73] hover:text-[#111114]'
                }`}
              >
                List
              </button>
              <button
                onClick={() => setView('map')}
                className={`rounded-full px-4 py-1.5 text-sm transition-colors ${
                  view === 'map' ? 'bg-[#111114] text-white' : 'text-[#6e6e73] hover:text-[#111114]'
                }`}
              >
                Map
              </button>
            </div>
          </div>

          {/* Asset-type row */}
          <div className="flex items-center gap-2 overflow-x-auto border-t border-[#e8e8ea] pt-3">
            {ASSET_TYPES.map((t) => (
              <button
                key={t.id}
                onClick={() => { setAssetType(t.id); setPage(1); }}
                className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs transition-colors ${
                  assetType === t.id
                    ? 'bg-[#111114] text-white'
                    : 'bg-[#fafafa] text-[#6e6e73] hover:bg-[#f0f0f2]'
                }`}
              >
                {t.label}
              </button>
            ))}
            {hasFilters && (
              <button
                onClick={() => {
                  setPurpose(''); setAssetType(''); setAreaQuery('');
                  setMinPrice(''); setMaxPrice(''); setBedrooms(''); setPage(1);
                }}
                className="ml-auto flex shrink-0 items-center gap-1 text-xs text-[#6e6e73] hover:text-[#111114]"
              >
                <X className="h-3.5 w-3.5" /> Clear filters
              </button>
            )}
          </div>
        </section>

        {/* ── Results / Map ── */}
        {view === 'map' ? (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-[#6e6e73]">
                {markerCount === null ? 'Move the map to search this area.' : `${markerCount} properties in view`}
              </p>
              <a
                className="text-xs text-[#6e6e73] underline-offset-2 hover:text-[#111114] hover:underline"
                href={
                  boundsRef.current.minLat
                    ? `https://www.openstreetmap.org/#map=14/${(boundsRef.current.minLat + boundsRef.current.maxLat) / 2}/${(boundsRef.current.minLng + boundsRef.current.maxLng) / 2}`
                    : 'https://www.openstreetmap.org/#map=12/23.78/90.41'
                }
                target="_blank"
                rel="noreferrer"
              >
                Open in OpenStreetMap
              </a>
            </div>
            <div className="h-[480px]">
              <FerioMap center={DHAKA_CENTER} markers={markers} onBoundsChange={handleBounds} />
            </div>
          </section>
        ) : (
          <section className="space-y-5">
            <div className="flex items-baseline justify-between">
              <p className="text-sm text-[#6e6e73]">
                {loading ? 'Searching…' : error ? 'Could not reach the marketplace service.' : `${meta.total} properties found`}
              </p>
              {!loading && !error && meta.totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <button
                    disabled={meta.page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="btn-pill-secondary p-2 disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="text-xs text-[#6e6e73]">Page {meta.page} of {meta.totalPages}</span>
                  <button
                    disabled={meta.page >= meta.totalPages}
                    onClick={() => setPage((p) => p + 1)}
                    className="btn-pill-secondary p-2 disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="Next page"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>

            {loading ? (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="space-y-3">
                    <div className="h-44 animate-pulse rounded-[10px] bg-[#fafafa]" />
                    <div className="h-4 w-3/4 animate-pulse rounded bg-[#fafafa]" />
                    <div className="h-3 w-1/2 animate-pulse rounded bg-[#fafafa]" />
                  </div>
                ))}
              </div>
            ) : error ? (
              <div className="rounded-[10px] border border-[#e8e8ea] p-10 text-center">
                <p className="text-sm text-[#111114]">The marketplace service is not responding.</p>
                <p className="mt-1 text-xs text-[#6e6e73]">
                  Start the API on port 6733, then reload this page.
                </p>
              </div>
            ) : items.length === 0 ? (
              <div className="rounded-[10px] border border-[#e8e8ea] p-10 text-center">
                <p className="text-sm text-[#111114]">No properties match these filters.</p>
                <p className="mt-1 text-xs text-[#6e6e73]">Try widening the price range or clearing the area.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((item) => (
                  <ListingGridCard key={item.id} item={item} />
                ))}
              </div>
            )}
          </section>
        )}
      </main>

      <footer className="border-t border-[#e8e8ea] py-8 text-center text-xs text-[#6e6e73]">
        Ferio — Bangladesh property marketplace · Maps © OpenStreetMap contributors
      </footer>
    </div>
  );
}

/** Image-first card per design language §6 — no border, no shadow. */
function ListingGridCard({ item }: { item: ListingCard }) {
  const badges = item.promotionBadges ?? [];
  return (
    <Link href={`/listings/${item.id}`} className="group block">
      <div className="relative mb-3 h-48 w-full overflow-hidden rounded-[10px] bg-[#fafafa]">
        {item.coverImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.coverImageUrl}
            alt={item.title}
            className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-[#6e6e73]">
            No photo
          </div>
        )}
        {badges.length > 0 && (
          <div className="absolute left-2 top-2 flex gap-1.5">
            {badges.includes('FEATURED') && (
              <span className="rounded-full bg-[#111114] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                Featured
              </span>
            )}
            {badges.includes('URGENT') && (
              <span className="rounded-full bg-[#fef3c7] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#92400e]">
                Urgent
              </span>
            )}
            {badges.includes('TOP_SEARCH') && (
              <span className="flex items-center gap-0.5 rounded-full bg-[#111114] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                <Star className="h-2.5 w-2.5" /> Spotlight
              </span>
            )}
          </div>
        )}
      </div>
      <div className="space-y-1">
        <p className="eyebrow-label">
          {item.purpose === 'SALE' ? 'For Sale' : 'For Rent'} · {item.assetType.replaceAll('_', ' ').toLowerCase()}
        </p>
        <h3 className="line-clamp-1 text-sm font-medium text-[#111114]">{item.title}</h3>
        <p className="flex items-center gap-1 text-xs text-[#6e6e73]">
          <MapPin className="h-3 w-3" /> {item.area ?? 'Dhaka'}
          {item.district ? `, ${item.district}` : ''}
        </p>
        <p className="pt-1 text-sm font-semibold tracking-tight">
          {formatPrice(item.price, item.purpose === 'RENT' ? 'MONTHLY' : null)}
        </p>
      </div>
    </Link>
  );
}
