'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  MapPin,
  BedDouble,
  Bath,
  Ruler,
  Car,
  Building2,
  Layers,
  FileText,
  BadgeCheck,
  Star,
} from 'lucide-react';
import { getListing, ensureMyAccount, createInquiry, type ListingDetail } from '@/lib/api';
import { useAuth } from '@/lib/auth';

function formatPrice(listing: ListingDetail): string {
  const amount = `৳ ${listing.price.toLocaleString('en-US')}`;
  if (listing.purpose === 'RENT') return `${amount}${listing.rentFrequency === 'MONTHLY' ? '/mo' : ''}`;
  if (listing.price >= 10_000_000) return `৳ ${(listing.price / 10_000_000).toFixed(2)} Crore`;
  if (listing.price >= 100_000) return `৳ ${(listing.price / 100_000).toFixed(1)} Lakh`;
  return amount;
}

function Spec({ icon: Icon, label, value }: { icon: typeof BedDouble; label: string; value: string | number | null | undefined }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div className="flex items-center gap-3 py-3">
      <Icon className="h-4 w-4 text-[#6e6e73]" />
      <span className="text-xs uppercase tracking-[0.12em] text-[#6e6e73]" style={{ fontSize: 11 }}>
        {label}
      </span>
      <span className="ml-auto text-sm text-[#111114]">{value}</span>
    </div>
  );
}

export default function ListingDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const auth = useAuth();

  const [listing, setListing] = useState<ListingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [activeImage, setActiveImage] = useState(0);

  const [inquirySent, setInquirySent] = useState(false);
  const [inquiryBusy, setInquiryBusy] = useState(false);
  const [inquiryError, setInquiryError] = useState<string | null>(null);

  async function submitInquiry(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!listing || !auth.user) return;
    const f = new FormData(e.currentTarget);
    setInquiryBusy(true);
    setInquiryError(null);
    try {
      const account = await ensureMyAccount(auth.user);
      await createInquiry({
        listingId: listing.id,
        senderAccountId: account.id,
        senderName: auth.user.displayName,
        senderPhone: String(f.get('phone') ?? '') || undefined,
        message: String(f.get('message')),
      });
      setInquirySent(true);
    } catch (err) {
      setInquiryError(err instanceof Error ? err.message : 'Could not send inquiry');
    } finally {
      setInquiryBusy(false);
    }
  }

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    getListing(id)
      .then((data) => !cancelled && setListing(data))
      .catch(() => !cancelled && setError(true))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [id]);

  // ── States ──
  if (loading) {
    return (
      <div className="mx-auto max-w-7xl space-y-8 px-6 py-12 lg:px-8">
        <div className="h-[420px] animate-pulse rounded-[10px] bg-[#fafafa]" />
        <div className="h-6 w-1/2 animate-pulse rounded bg-[#fafafa]" />
        <div className="h-4 w-1/3 animate-pulse rounded bg-[#fafafa]" />
      </div>
    );
  }

  if (error || !listing) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-24 text-center">
        <p className="text-sm text-[#111114]">This listing is not available.</p>
        <p className="mt-1 text-xs text-[#6e6e73]">
          It may have been paused by the seller or removed by moderators.
        </p>
        <Link href="/" className="btn-pill-secondary mt-6 inline-flex text-xs">
          Back to search
        </Link>
      </div>
    );
  }

  const gallery = listing.media.filter((m) => m.type !== 'FLOOR_PLAN');
  const cover = gallery.find((m) => m.isCover) ?? gallery[0];
  const ordered = cover ? [cover, ...gallery.filter((m) => m.id !== cover.id)] : [];

  return (
    <div className="min-h-screen bg-white">
      {/* ── Header ── */}
      <header className="border-b border-[#e8e8ea]">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#111114] text-sm font-bold text-white">
              F
            </div>
            <span className="text-base font-semibold tracking-tight">Ferio</span>
          </Link>
          <Link
            href="/"
            className="flex items-center gap-1.5 text-xs text-[#6e6e73] transition-colors hover:text-[#111114]"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to search
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-12 px-6 py-10 lg:px-8">
        {/* ── Gallery ── */}
        <section className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          <div className="h-[380px] overflow-hidden rounded-[10px] bg-[#fafafa] lg:col-span-2">
            {ordered[0] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={ordered[activeImage]?.url ?? cover?.url} alt={listing.title} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-[#6e6e73]">No photos</div>
            )}
          </div>
          {ordered.length > 1 && (
            <div className="grid grid-cols-3 gap-3 lg:grid-cols-1">
              {ordered.slice(0, 4).map((m, i) => (
                <button
                  key={m.id}
                  onClick={() => setActiveImage(i)}
                  className={`h-full min-h-[88px] overflow-hidden rounded-[10px] border transition-colors ${
                    activeImage === i ? 'border-[#111114]' : 'border-transparent'
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={m.url} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </section>

        <div className="grid grid-cols-1 gap-14 lg:grid-cols-3">
          {/* ── Main column ── */}
          <div className="space-y-10 lg:col-span-2">
            <header className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-[#111114] px-2.5 py-0.5 text-[11px] font-semibold text-white">
                  {listing.purpose === 'SALE' ? 'For Sale' : 'For Rent'}
                </span>
                {listing.priceNegotiable && (
                  <span className="rounded-full bg-[#111114] px-2.5 py-0.5 text-[11px] font-semibold text-white">
                    Negotiable
                  </span>
                )}
                {(listing.promotionBadges ?? []).includes('FEATURED') && (
                  <span className="flex items-center gap-1 rounded-full bg-[#111114] px-2.5 py-0.5 text-[11px] font-semibold text-white">
                    <Star className="h-3 w-3" /> Featured
                  </span>
                )}
                {(listing.promotionBadges ?? []).includes('TOP_SEARCH') && (
                  <span className="flex items-center gap-1 rounded-full bg-[#111114] px-2.5 py-0.5 text-[11px] font-semibold text-white">
                    <Star className="h-3 w-3" /> Spotlight
                  </span>
                )}
                {(listing.promotionBadges ?? []).includes('URGENT') && (
                  <span className="rounded-full bg-[#fef3c7] px-2.5 py-0.5 text-[11px] font-semibold text-[#92400e]">
                    Urgent
                  </span>
                )}
                <span className="text-[11px] uppercase tracking-[0.12em] text-[#6e6e73]">
                  {listing.assetType.replaceAll('_', ' ').toLowerCase()}
                </span>
              </div>

              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{listing.title}</h1>

              <p className="flex items-center gap-1.5 text-sm text-[#6e6e73]">
                <MapPin className="h-4 w-4" />
                {[listing.address, listing.area, listing.district, listing.division]
                  .filter(Boolean)
                  .join(', ') || 'Location on request'}
              </p>

              <p className="pt-1 text-2xl font-semibold tracking-tight">{formatPrice(listing)}</p>
            </header>

            {/* Specs — hairline rows, no boxed card */}
            <section>
              <h2 className="eyebrow-label mb-2">Details</h2>
              <div className="divide-y divide-[#e8e8ea]">
                <Spec icon={BedDouble} label="Bedrooms" value={listing.bedrooms} />
                <Spec icon={Bath} label="Bathrooms" value={listing.bathrooms} />
                <Spec icon={Ruler} label="Area" value={listing.areaSqFt ? `${listing.areaSqFt.toLocaleString()} sq ft` : null} />
                <Spec icon={Layers} label="Floor" value={listing.totalFloors ? `${listing.floor ?? '—'} of ${listing.totalFloors}` : listing.floor} />
                <Spec icon={Car} label="Parking" value={listing.parking ? `${listing.parking} space${listing.parking > 1 ? 's' : ''}` : null} />
                <Spec icon={Building2} label="Furnishing" value={listing.furnishing?.replaceAll('_', ' ').toLowerCase()} />
                {listing.landSizeKatha && (
                  <Spec icon={Ruler} label="Land size" value={`${listing.landSizeKatha} katha`} />
                )}
              </div>
            </section>

            {listing.description && (
              <section>
                <h2 className="eyebrow-label mb-3">About this property</h2>
                <p className="whitespace-pre-line text-sm leading-relaxed text-[#111114]">
                  {listing.description}
                </p>
              </section>
            )}

            {/* §24 Room-by-room breakdown */}
            {(listing.rooms ?? []).length > 0 && (
              <section>
                <h2 className="eyebrow-label mb-3">Room by room</h2>
                <ul className="divide-y divide-[#e8e8ea]">
                  {listing.rooms.map((room) => {
                    const sqft =
                      room.lengthFt != null && room.widthFt != null
                        ? Math.round(room.lengthFt * room.widthFt * 100) / 100
                        : null;
                    return (
                      <li key={room.id} className="flex gap-4 py-4">
                        {room.media.length > 0 ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={room.media[0].url}
                            alt={room.name}
                            className="h-20 w-28 shrink-0 rounded-[10px] object-cover"
                          />
                        ) : (
                          <div className="flex h-20 w-28 shrink-0 items-center justify-center rounded-[10px] bg-[#fafafa] text-[10px] text-[#6e6e73]">
                            No photo
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-baseline gap-x-3">
                            <p className="text-sm font-medium">{room.name}</p>
                            <span className="text-[11px] uppercase tracking-[0.12em] text-[#6e6e73]">
                              {room.type.replaceAll('_', ' ').toLowerCase()}
                            </span>
                            {sqft !== null && (
                              <span className="ml-auto whitespace-nowrap text-xs tabular-nums text-[#111114]">
                                {room.lengthFt}&prime; &times; {room.widthFt}&prime; · {sqft.toLocaleString()} sq ft
                              </span>
                            )}
                          </div>
                          {room.description && (
                            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[#6e6e73]">
                              {room.description}
                            </p>
                          )}
                          {room.media.length > 1 && (
                            <div className="mt-2 flex gap-2">
                              {room.media.slice(1, 5).map((mm) => (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  key={mm.id}
                                  src={mm.url}
                                  alt={mm.caption ?? ''}
                                  className="h-12 w-16 rounded-md object-cover"
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            {listing.amenities.length > 0 && (
              <section>
                <h2 className="eyebrow-label mb-3">Amenities</h2>
                <div className="flex flex-wrap gap-2">
                  {listing.amenities.map((a) => (
                    <span key={a} className="rounded-full border border-[#e8e8ea] px-3 py-1 text-xs text-[#111114]">
                      {a}
                    </span>
                  ))}
                </div>
              </section>
            )}

            {/* Documents — only what visibility rules allow (enforced server-side) */}
            {listing.documents.length > 0 && (
              <section>
                <h2 className="eyebrow-label mb-3">Documents</h2>
                <ul className="divide-y divide-[#e8e8ea]">
                  {listing.documents.map((d) => (
                    <li key={d.id} className="flex items-center gap-3 py-3">
                      <FileText className="h-4 w-4 text-[#6e6e73]" />
                      <span className="text-sm">{d.name}</span>
                      <span className="ml-auto text-[11px] uppercase tracking-[0.12em] text-[#6e6e73]">
                        {d.docType.toLowerCase()}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>

          {/* ── Sidebar ── */}
          <aside className="space-y-6">
            <div className="sticky top-24 space-y-6">
              {/* Inquiry */}
              <div className="space-y-4 rounded-[10px] border border-[#e8e8ea] p-5">
                <h3 className="eyebrow-label">Interested?</h3>
                {!auth.ready ? null : !auth.token ? (
                  <>
                    <p className="text-xs leading-relaxed text-[#6e6e73]">
                      Sign in to message the seller and unlock shared documents.
                    </p>
                    <Link href="/login" className="btn-pill-primary w-full py-2.5 text-center text-sm">
                      Sign in to inquire
                    </Link>
                  </>
                ) : inquirySent ? (
                  <p className="text-xs text-emerald-700">
                    Inquiry sent — the seller will contact you.
                  </p>
                ) : (
                  <form onSubmit={submitInquiry} className="space-y-3">
                    <textarea
                      name="message"
                      required
                      rows={3}
                      defaultValue="I am interested in this property. Please arrange a viewing."
                      className="w-full rounded-[10px] border border-[#e8e8ea] bg-[#fafafa] p-2.5 text-xs outline-none focus:border-[#111114]"
                    />
                    <input
                      name="phone"
                      placeholder="Your phone (optional)"
                      className="w-full rounded-[10px] border border-[#e8e8ea] bg-[#fafafa] p-2.5 text-xs outline-none focus:border-[#111114]"
                    />
                    {inquiryError && <p className="text-[11px] text-rose-700">{inquiryError}</p>}
                    <button
                      type="submit"
                      disabled={inquiryBusy}
                      className="btn-pill-primary w-full py-2.5 text-sm disabled:opacity-50"
                    >
                      {inquiryBusy ? 'Sending…' : 'Send inquiry'}
                    </button>
                  </form>
                )}
              </div>

              {/* Seller */}
              <div className="space-y-4 rounded-[10px] border border-[#e8e8ea] p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#fafafa] text-sm font-semibold text-[#111114]">
                    {listing.seller.displayName?.[0]?.toUpperCase() ?? '?'}
                  </div>
                  <div>
                    <p className="flex items-center gap-1.5 text-sm font-medium">
                      {listing.seller.displayName}
                      {listing.seller.isIdentityVerified && (
                        <BadgeCheck className="h-4 w-4 text-emerald-700" />
                      )}
                    </p>
                    <p className="text-xs capitalize text-[#6e6e73]">
                      {listing.sellerType?.toLowerCase() ?? listing.seller.accountType?.toLowerCase()} ·{' '}
                      {listing.seller.isIdentityVerified ? 'Identity verified' : 'Unverified'}
                    </p>
                  </div>
                </div>

                {listing.seller.phone ? (
                  <a href={`tel:${listing.seller.phone}`} className="btn-pill-primary w-full py-2.5 text-sm">
                    Call {listing.seller.phone}
                  </a>
                ) : (
                  <button className="btn-pill-primary w-full py-2.5 text-sm" disabled style={{ opacity: 0.4 }}>
                    Contact via inquiry
                  </button>
                )}
                {listing.seller.email && (
                  <a
                    href={`mailto:${listing.seller.email}`}
                    className="btn-pill-secondary w-full py-2.5 text-sm"
                  >
                    Email seller
                  </a>
                )}

                <p className="text-[11px] leading-relaxed text-[#6e6e73]">
                  Mention Ferio when you call. Viewings are arranged directly with the seller.
                </p>
              </div>

              {/* Location */}
              {(listing.latitude || listing.address) && (
                <div className="space-y-3 rounded-[10px] border border-[#e8e8ea] p-5">
                  <h3 className="eyebrow-label">Location</h3>
                  <p className="text-sm text-[#111114]">
                    {[listing.area, listing.district].filter(Boolean).join(', ') || listing.address}
                  </p>
                  <a
                    className="block h-32 overflow-hidden rounded-[10px] border border-[#e8e8ea]"
                    target="_blank"
                    rel="noreferrer"
                    href={
                      listing.latitude && listing.longitude
                        ? `https://www.openstreetmap.org/?mlat=${listing.latitude}&mlon=${listing.longitude}#map=16/${listing.latitude}/${listing.longitude}`
                        : 'https://www.openstreetmap.org'
                    }
                  >
                    {listing.latitude && listing.longitude ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={`https://staticmap.openstreetmap.de/staticmap.php?center=${listing.latitude},${listing.longitude}&zoom=15&size=400x160&marker=${listing.latitude},${listing.longitude}`}
                        alt="Map preview"
                        className="h-full w-full object-cover"
                        onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-[#6e6e73]">
                        Exact map after inquiry
                      </div>
                    )}
                  </a>
                  <p className="text-[11px] text-[#6e6e73]">© OpenStreetMap contributors</p>
                </div>
              )}

              <p className="text-[11px] leading-relaxed text-[#6e6e73]">
                Listed {new Date(listing.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}.
                Never pay before visiting the property in person.
              </p>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
