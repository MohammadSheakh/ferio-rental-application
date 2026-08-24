'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ImagePlus, Plus, X, Star } from 'lucide-react';
import {
  ensureMyAccount,
  createListing,
  addListingMedia,
  addListingRoom,
  uploadImage,
  getPromotionCatalog,
  orderPromotion,
  ROOM_TYPES,
  type RoomInput,
  type PromotionCatalog,
} from '@/lib/api';
import { useAuth } from '@/lib/auth';

const ASSET_TYPES = [
  'APARTMENT', 'HOUSE', 'ROOM', 'LAND', 'SHOP',
  'OFFICE', 'WAREHOUSE', 'STORE_ROOM', 'COMMERCIAL_SPACE', 'BUILDING', 'OTHER',
];

interface PhotoItem { url: string; uploading?: boolean }
interface RoomDraft {
  name: string; type: string; lengthFt: string; widthFt: string;
  description: string; photos: PhotoItem[];
}

const emptyRoom = (): RoomDraft => ({
  name: '', type: 'BEDROOM', lengthFt: '', widthFt: '', description: '', photos: [],
});

export default function PostPropertyPage() {
  const auth = useAuth();
  const router = useRouter();
  const photoInputRef = useRef<HTMLInputElement>(null);

  const [purpose, setPurpose] = useState<'RENT' | 'SALE'>('RENT');
  const [assetType, setAssetType] = useState('APARTMENT');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [area, setArea] = useState('');
  const [district, setDistrict] = useState('Dhaka');
  const [bedrooms, setBedrooms] = useState('');
  const [bathrooms, setBathrooms] = useState('');
  const [floor, setFloor] = useState('');
  const [areaSqFt, setAreaSqFt] = useState('');
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [rooms, setRooms] = useState<RoomDraft[]>([]);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doneId, setDoneId] = useState<string | null>(null);

  if (!auth.ready) return null;
  if (!auth.token || !auth.user) {
    return (
      <Shell>
        <div className="mx-auto max-w-md px-6 py-24 text-center">
          <p className="text-sm">Sign in to post a property.</p>
          <p className="mt-1 text-xs text-[#6e6e73]">
            Posting is free — no subscription needed.
          </p>
          <Link href="/login" className="btn-pill-primary mt-6 inline-flex px-5 py-2 text-sm">
            Sign in
          </Link>
        </div>
      </Shell>
    );
  }

  async function handleFiles(files: FileList | null, intoRoom?: number) {
    if (!files?.length) return;
    for (const file of Array.from(files)) {
      // optimistic placeholder then fill
      const placeholder: PhotoItem = { url: '', uploading: true };
      if (intoRoom === undefined) setPhotos((p) => [...p, placeholder]);
      else
        setRooms((rs) =>
          rs.map((r2, i) => (i === intoRoom ? { ...r2, photos: [...r2.photos, placeholder] } : r2)),
        );
      try {
        const res = await uploadImage(file);
        const item: PhotoItem = { url: res.url };
        if (intoRoom === undefined)
          setPhotos((p) => p.map((x) => (x.url === '' && x.uploading ? item : x)));
        else
          setRooms((rs) =>
            rs.map((r2, i) =>
              i === intoRoom
                ? { ...r2, photos: r2.photos.map((x) => (x.url === '' && x.uploading ? item : x)) }
                : r2,
            ),
          );
      } catch {
        setError(`Could not upload "${file.name}"`);
        if (intoRoom === undefined) setPhotos((p) => p.filter((x) => x !== placeholder));
        else
          setRooms((rs) =>
            rs.map((r2, i) => (i === intoRoom ? { ...r2, photos: r2.photos.filter((x) => x !== placeholder) } : r2)),
          );
      }
    }
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!title || !price) {
      setError('Title and price are required.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const account = await ensureMyAccount(auth.user!);
      const listing = (await createListing(account.id, {
        purpose,
        assetType,
        title,
        description: description || undefined,
        price: Number(price),
        area: area || undefined,
        district: district || undefined,
        bedrooms: bedrooms ? Number(bedrooms) : undefined,
        bathrooms: bathrooms ? Number(bathrooms) : undefined,
        floor: floor ? Number(floor) : undefined,
        areaSqFt: areaSqFt ? Number(areaSqFt) : undefined,
      })) as { id: string };

      const readyPhotos = photos.filter((p) => p.url);
      for (let i = 0; i < readyPhotos.length; i++) {
        await addListingMedia(account.id, listing.id, {
          url: readyPhotos[i].url,
          isCover: i === 0,
          order: i,
        });
      }
      const roomInputs: RoomInput[] = rooms
        .filter((rm) => rm.name.trim())
        .map((rm, i) => ({
          name: rm.name.trim(),
          type: rm.type,
          lengthFt: rm.lengthFt ? Number(rm.lengthFt) : undefined,
          widthFt: rm.widthFt ? Number(rm.widthFt) : undefined,
          description: rm.description || undefined,
          sortOrder: i,
          media: rm.photos.filter((p) => p.url).map((p) => ({ url: p.url })),
        }));
      for (const room of roomInputs) {
        await addListingRoom(account.id, listing.id, room);
      }
      setDoneId(listing.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit the ad');
    } finally {
      setBusy(false);
    }
  }

  if (doneId) {
    return (
      <Shell>
        <SuccessScreen listingId={doneId} />
      </Shell>
    );
  }

  return (
    <Shell>
      <main className="mx-auto max-w-3xl space-y-8 px-6 py-10 lg:px-8">
        <header className="space-y-2">
          <p className="eyebrow-label">Free advertisement</p>
          <h1 className="text-2xl font-semibold tracking-tight">Post a property</h1>
          <p className="text-xs text-[#6e6e73]">
            No subscription required. Your ad goes live after a quick review.
          </p>
        </header>

        <form onSubmit={submit} className="space-y-6">
          {/* Basics */}
          <section className="space-y-4 rounded-[10px] border border-[#e8e8ea] p-5">
            <div className="flex items-center gap-0.5 self-start rounded-full border border-[#e8e8ea] bg-[#fafafa] p-1">
              {([['RENT', 'For Rent'], ['SALE', 'For Sale']] as const).map(([v, l]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setPurpose(v)}
                  className={`rounded-full px-4 py-1.5 text-sm transition-colors ${
                    purpose === v ? 'bg-[#111114] text-white' : 'text-[#6e6e73] hover:text-[#111114]'
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
            <Field label="Title">
              <input required value={title} onChange={(e) => setTitle(e.target.value)}
                placeholder="3BR apartment in Rampura, near circular road"
                className={inputCls} />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Category">
                <select value={assetType} onChange={(e) => setAssetType(e.target.value)} className={inputCls}>
                  {ASSET_TYPES.map((t) => (
                    <option key={t} value={t}>{t.replaceAll('_', ' ').toLowerCase()}</option>
                  ))}
                </select>
              </Field>
              <Field label={purpose === 'RENT' ? 'Monthly rent ৳' : 'Asking price ৳'}>
                <input required inputMode="numeric" value={price}
                  onChange={(e) => setPrice(e.target.value.replace(/\D/g, ''))}
                  placeholder={purpose === 'RENT' ? '25000' : '6500000'} className={inputCls} />
              </Field>
              <Field label="Area">
                <input value={area} onChange={(e) => setArea(e.target.value)}
                  placeholder="Rampura" className={inputCls} />
              </Field>
              <Field label="District">
                <input value={district} onChange={(e) => setDistrict(e.target.value)} className={inputCls} />
              </Field>
              <Field label="Bedrooms"><input inputMode="numeric" value={bedrooms} onChange={(e) => setBedrooms(e.target.value.replace(/\D/g, ''))} className={inputCls} /></Field>
              <Field label="Bathrooms"><input inputMode="numeric" value={bathrooms} onChange={(e) => setBathrooms(e.target.value.replace(/\D/g, ''))} className={inputCls} /></Field>
              <Field label="Floor"><input inputMode="numeric" value={floor} onChange={(e) => setFloor(e.target.value.replace(/\D/g, ''))} className={inputCls} /></Field>
              <Field label="Size (sq ft)"><input inputMode="numeric" value={areaSqFt} onChange={(e) => setAreaSqFt(e.target.value.replace(/\D/g, ''))} className={inputCls} /></Field>
            </div>
            <Field label="Description">
              <textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)}
                placeholder="What makes this property worth visiting?"
                className={`${inputCls} leading-relaxed`} />
            </Field>
          </section>

          {/* Photos */}
          <section className="space-y-3 rounded-[10px] border border-[#e8e8ea] p-5">
            <div className="flex items-center justify-between">
              <h2 className="eyebrow-label">Photos</h2>
              <span className="text-[11px] text-[#6e6e73]">First photo is the cover</span>
            </div>
            <input ref={photoInputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden
              onChange={(e) => { void handleFiles(e.target.files); e.currentTarget.value = ''; }} />
            <div className="flex flex-wrap items-center gap-3">
              {photos.map((p, i) => (
                <div key={`${p.url}-${i}`} className="group relative h-20 w-28 overflow-hidden rounded-[10px] bg-[#fafafa]">
                  {p.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-[10px] text-[#6e6e73]">…</div>
                  )}
                  {i === 0 && p.url && (
                    <span className="absolute left-1 top-1 rounded-full bg-[#111114] px-1.5 py-0.5 text-[9px] font-semibold uppercase text-white">Cover</span>
                  )}
                  <button type="button"
                    onClick={() => setPhotos((prev) => prev.filter((_, j) => j !== i))}
                    className="absolute right-1 top-1 rounded-full bg-white/90 p-0.5 text-[#111114] opacity-0 transition-opacity group-hover:opacity-100">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              <button type="button" onClick={() => photoInputRef.current?.click()}
                className="btn-pill-secondary flex items-center gap-1.5 px-4 py-2 text-xs">
                <ImagePlus className="h-3.5 w-3.5" /> Add photos
              </button>
            </div>
          </section>

          {/* Rooms */}
          <section className="space-y-4 rounded-[10px] border border-[#e8e8ea] p-5">
            <div className="flex items-center justify-between">
              <h2 className="eyebrow-label">Room by room</h2>
              <span className="text-[11px] text-[#6e6e73]">Optional — helps renters qualify themselves</span>
            </div>
            {rooms.map((room, idx) => (
              <div key={idx} className="space-y-3 rounded-[10px] bg-[#fafafa] p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium">Room {idx + 1}</p>
                  <button type="button" onClick={() => setRooms((rs) => rs.filter((_, i) => i !== idx))}
                    className="text-[11px] text-[#6e6e73] hover:text-[#111114]">Remove</button>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Field label="Name">
                    <input value={room.name} onChange={(e) => setRooms((rs) => rs.map((r2, i) => (i === idx ? { ...r2, name: e.target.value } : r2)))}
                      placeholder="Master bedroom" className={inputCls} />
                  </Field>
                  <Field label="Type">
                    <select value={room.type} onChange={(e) => setRooms((rs) => rs.map((r2, i) => (i === idx ? { ...r2, type: e.target.value } : r2)))} className={inputCls}>
                      {ROOM_TYPES.map((t) => <option key={t} value={t}>{t.replaceAll('_', ' ').toLowerCase()}</option>)}
                    </select>
                  </Field>
                  <Field label="Length (ft)">
                    <input inputMode="decimal" value={room.lengthFt} onChange={(e) => setRooms((rs) => rs.map((r2, i) => (i === idx ? { ...r2, lengthFt: e.target.value } : r2)))} className={inputCls} />
                  </Field>
                  <Field label="Width (ft)">
                    <input inputMode="decimal" value={room.widthFt} onChange={(e) => setRooms((rs) => rs.map((r2, i) => (i === idx ? { ...r2, widthFt: e.target.value } : r2)))} className={inputCls} />
                  </Field>
                </div>
                <Field label="Note">
                  <input value={room.description} onChange={(e) => setRooms((rs) => rs.map((r2, i) => (i === idx ? { ...r2, description: e.target.value } : r2)))}
                    placeholder="Attached bath, south-facing windows…" className={inputCls} />
                </Field>
                <div className="flex flex-wrap items-center gap-2">
                  {room.photos.map((p, pi) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={pi} src={p.url} alt="" className="h-12 w-16 rounded-md object-cover" />
                  ))}
                  <label className="btn-pill-secondary cursor-pointer px-3 py-1.5 text-[11px]">
                    <ImagePlus className="mr-1 inline h-3 w-3" /> Photos
                    <input type="file" accept="image/jpeg,image/png,image/webp" multiple hidden
                      onChange={(e) => { void handleFiles(e.target.files, idx); e.currentTarget.value = ''; }} />
                  </label>
                </div>
              </div>
            ))}
            <button type="button" onClick={() => setRooms((rs) => [...rs, emptyRoom()])}
              className="flex items-center gap-1.5 text-xs text-[#6e6e73] hover:text-[#111114]">
              <Plus className="h-3.5 w-3.5" /> Add a room
            </button>
          </section>

          {error && <p className="text-xs text-rose-700">{error}</p>}

          <button type="submit" disabled={busy} className="btn-pill-primary w-full py-3 text-sm disabled:opacity-50">
            {busy ? 'Submitting…' : 'Submit for review'}
          </button>
        </form>
      </main>
    </Shell>
  );
}

const inputCls =
  'w-full rounded-[10px] border border-[#e8e8ea] bg-[#fafafa] px-3 py-2 text-sm outline-none transition-colors focus:border-[#111114]';

/** §23 upsell — optional paid boost right after the ad is submitted. */
function SuccessScreen({ listingId }: { listingId: string }) {
  const router = useRouter();
  const [catalog, setCatalog] = useState<PromotionCatalog | null>(null);
  const [type, setType] = useState<string>('FEATURED');
  const [days, setDays] = useState<number>(15);
  const [ordered, setOrdered] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getPromotionCatalog()
      .then((c) => {
        setCatalog(c);
        if (c.products[0]) setType(c.products[0].type);
      })
      .catch(() => setCatalog(null));
  }, []);

  const product = catalog?.products.find((p) => p.type === type);
  const price = product?.durations.find((x) => x.days === days)?.priceBdt;

  async function boost() {
    setBusy(true);
    try {
      await orderPromotion(listingId, { type, durationDays: days });
      setOrdered(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-6 px-6 py-16 text-center">
      <Star className="mx-auto h-6 w-6 text-[#111114]" />
      <div>
        <p className="text-sm font-medium">Your ad has been submitted.</p>
        <p className="mt-1 text-xs leading-relaxed text-[#6e6e73]">
          It appears publicly once our team reviews it. Rented it already? Manage
          rent, utilities and maintenance with Ferio Rental.
        </p>
      </div>

      {catalog && !ordered && (
        <section className="space-y-4 rounded-[10px] border border-[#e8e8ea] p-5 text-left">
          <div className="flex items-baseline justify-between">
            <h2 className="eyebrow-label">Get more eyes on it</h2>
            <span className="text-[11px] text-[#6e6e73]">Optional · paid</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {catalog.products.map((p) => (
              <button
                key={p.type}
                type="button"
                onClick={() => setType(p.type)}
                className={`rounded-full px-2 py-1.5 text-xs transition-colors ${
                  type === p.type ? 'bg-[#111114] text-white' : 'bg-[#fafafa] text-[#6e6e73] hover:text-[#111114]'
                }`}
              >
                {p.type.replaceAll('_', ' ').toLowerCase()}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            {(product?.durations ?? []).map((x) => (
              <button
                key={x.days}
                type="button"
                onClick={() => setDays(x.days)}
                className={`flex-1 rounded-[10px] border px-2 py-2 text-center text-xs transition-colors ${
                  days === x.days ? 'border-[#111114]' : 'border-[#e8e8ea]'
                }`}
              >
                {x.days} days<br />
                <span className="font-semibold">৳{x.priceBdt.toLocaleString()}</span>
              </button>
            ))}
          </div>
          <button onClick={boost} disabled={busy} className="btn-pill-primary w-full py-2.5 text-sm disabled:opacity-50">
            {busy ? 'Placing order…' : `Boost my ad${price ? ` — ৳${price.toLocaleString()}` : ''}`}
          </button>
          <p className="text-[11px] leading-relaxed text-[#6e6e73]">
            Pay by bKash/Nagad/bank after ordering — our team confirms your payment
            and the boost starts immediately.
          </p>
        </section>
      )}

      {ordered && (
        <p className="text-xs text-emerald-700">
          Boost ordered — send the payment and we will activate it.
        </p>
      )}

      <div className="flex items-center justify-center gap-3">
        <Link href={`/listings/${listingId}`} className="btn-pill-secondary inline-flex px-5 py-2 text-xs">
          View my listing
        </Link>
        <button onClick={() => router.push('/')} className="btn-pill-secondary px-5 py-2 text-xs">
          Back to search
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="block text-[11px] uppercase tracking-[0.12em] text-[#6e6e73]" style={{ fontSize: 11 }}>
        {label}
      </span>
      {children}
    </label>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white text-[#111114]">
      <header className="border-b border-[#e8e8ea]">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#111114] text-sm font-bold text-white">F</div>
            <span className="text-base font-semibold tracking-tight">Ferio</span>
          </Link>
          <Link href="/" className="flex items-center gap-1.5 text-xs text-[#6e6e73] hover:text-[#111114]">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to search
          </Link>
        </div>
      </header>
      {children}
    </div>
  );
}
