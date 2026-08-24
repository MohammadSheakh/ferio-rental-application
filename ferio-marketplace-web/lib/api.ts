/**
 * Ferio Marketplace — API client
 *
 * Single integration point with the three-plane backend. Base URL is
 * environment-configurable; defaults match local development.
 */

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:6733/api/v1';

// ── Contracts ──

export type ListingPurpose = 'RENT' | 'SALE';

export interface SellerSummary {
  displayName: string | null;
  accountType: string | null;
  isIdentityVerified: boolean;
  verificationBadge?: string | null;
}

export interface ListingCard {
  id: string;
  title: string;
  price: number;
  purpose: ListingPurpose;
  assetType: string;
  latitude: number | null;
  longitude: number | null;
  area: string | null;
  district: string | null;
  coverImageUrl: string | null;
  distanceKm?: number | null;
  /** §23 paid promotion state */
  promotionTier?: number;
  promotionBadges?: string[];
  seller: SellerSummary;
  createdAt: string;
}

/** Full listing shape returned by Prisma includes. */
export interface ListingDetail {
  id: string;
  title: string;
  description: string | null;
  slug: string | null;
  purpose: ListingPurpose;
  assetType: string;
  sellerType: string;
  status: string;

  price: number;
  priceNegotiable: boolean;
  rentFrequency: string | null;
  availableFrom: string | null;

  bedrooms: number | null;
  bathrooms: number | null;
  floor: number | null;
  totalFloors: number | null;
  areaSqFt: number | null;
  landSizeKatha: number | null;
  parking: number | null;
  furnishing: string | null;
  amenities: string[];

  address: string | null;
  area: string | null;
  neighbourhood: string | null;
  district: string | null;
  division: string | null;
  postalCode: string | null;
  latitude: number | null;
  longitude: number | null;

  publishedAt: string | null;
  createdAt: string;

  /** §23 live promotion badges (FEATURED / URGENT / TOP_SEARCH) */
  promotionTier?: number;
  promotionBadges?: string[];
  promotedUntil?: string | null;

  seller: {
    id: string;
    displayName: string;
    phone: string | null;
    email: string | null;
    accountType: string;
    isIdentityVerified: boolean;
    verificationBadge: string | null;
    avatarUrl: string | null;
  };
  media: Array<{
    id: string;
    url: string;
    type: string;
    order: number;
    isCover: boolean;
    caption: string | null;
  }>;
  /** Filtered server-side by document visibility for the current viewer. */
  documents: Array<{
    id: string;
    name: string;
    docType: string;
    visibility: string;
  }>;
  /** §24 room-by-room breakdown (projected from managed units or seller-entered) */
  rooms: Array<{
    id: string;
    name: string;
    type: string;
    lengthFt: number | null;
    widthFt: number | null;
    description: string | null;
    sortOrder: number;
    media: Array<{ id: string; url: string; caption: string | null }>;
  }>;
}

export interface SearchParams {
  purpose?: ListingPurpose;
  assetType?: string;
  area?: string;
  district?: string;
  minPrice?: number;
  maxPrice?: number;
  bedrooms?: number;
  lat?: number;
  lng?: number;
  radiusKm?: number;
  sortBy?: 'relevance' | 'nearest' | 'price_asc' | 'price_desc' | 'newest';
  page?: number;
  limit?: number;
}

export interface SearchResult {
  items: ListingCard[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export interface MapMarker {
  id: string;
  title: string;
  price: number;
  purpose: string;
  latitude: number;
  longitude: number;
  promotionTier?: number;
  promotionBadges?: string[];
}

export interface MapResult {
  markers: MapMarker[];
  meta: {
    count: number;
    truncated: boolean;
    bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number };
  };
}

/** Read the full stored identity (token + refresh). */
function readIdentity(): { token: string; refreshToken?: string } | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem('ferio_identity');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function authToken(): string | null {
  return readIdentity()?.token ?? null;
}

/**
 * On a 401 with a stored refresh token, rotate once and replay.
 * A failed rotation drops the local session (family revoked).
 */
async function fetchWithRefresh(path: string, init: RequestInit, res: Response): Promise<Response> {
  const session = readIdentity();
  if (!session?.refreshToken) return res;

  const refreshRes = await fetch(`${API_URL}/identity/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: session.refreshToken }),
  });
  if (!refreshRes.ok) {
    window.localStorage.removeItem('ferio_identity');
    return res;
  }
  const json = await refreshRes.json();
  const next = (json?.data ?? json) as { token: string; refreshToken: string };
  window.localStorage.setItem(
    'ferio_identity',
    JSON.stringify({ ...session, token: next.token, refreshToken: next.refreshToken }),
  );

  return fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      ...(init.headers as Record<string, string> | undefined),
      Authorization: `Bearer ${next.token}`,
    },
  });
}


// ── Fetchers ──

/**
 * The API wraps every payload in a global interceptor envelope:
 *   { success, data, message }
 * Unwrap here so callers work with plain contracts.
 */
async function get<T>(path: string): Promise<T> {
  const token = authToken();
  const init: RequestInit = {
    cache: 'no-store',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  };
  let res = await fetch(`${API_URL}${path}`, init);
  if (res.status === 401 && token) {
    res = await fetchWithRefresh(path, init, res);
  }
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${path}`);
  }
  const body = await res.json();
  return (body && typeof body === 'object' && 'data' in body ? body.data : body) as T;
}

export function searchListings(params: SearchParams): Promise<SearchResult> {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== '' && v !== null) qs.set(k, String(v));
  });
  return get(`/marketplace/listings/search?${qs.toString()}`);
}

export function getListing(id: string): Promise<ListingDetail> {
  return get(`/marketplace/listings/${id}`);
}

/** §23 homepage spotlight — listings with a live TOP_SEARCH promotion. */
export interface SpotlightItem {
  id: string;
  title: string;
  price: number;
  purpose: ListingPurpose;
  area: string | null;
  coverImageUrl: string | null;
  promotedUntil: string | null;
}

export function getSpotlight(limit = 6): Promise<{ items: SpotlightItem[] }> {
  return get(`/marketplace/listings/spotlight?limit=${limit}`);
}

/** Current viewer's marketplace profile, creating it on first login. */
export async function ensureMyAccount(user: {
  userId: string;
  displayName: string;
}): Promise<{ id: string }> {
  try {
    return await get(`/marketplace/accounts/me/${user.userId}`);
  } catch {
    return post('/marketplace/accounts', {
      centralUserId: user.userId,
      displayName: user.displayName,
      accountType: 'OWNER',
    }) as Promise<{ id: string }>;
  }
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const token = authToken();
  const init: RequestInit = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  };
  let res = await fetch(`${API_URL}${path}`, init);
  if (res.status === 401 && token) {
    res = await fetchWithRefresh(path, init, res);
  }
  if (!res.ok) throw new Error(`API ${res.status}: ${path}`);
  const json = await res.json();
  return (json?.data ?? json) as T;
}

/** Send an inquiry to a listing seller. */
export function createInquiry(input: {
  listingId: string;
  senderAccountId: string;
  senderName: string;
  senderPhone?: string;
  message: string;
}): Promise<{ id: string }> {
  const { listingId, ...body } = input;
  return post(`/marketplace/listings/${listingId}/inquiries`, body);
}

// ── Uploads (§13 secure pipeline) ──

export async function uploadImage(
  file: File,
): Promise<{ url: string; key: string; contentType: string; size: number }> {
  const token = authToken();
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${API_URL}/marketplace/uploads/images`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: form,
  });
  if (!res.ok) throw new Error(`Upload failed (${res.status})`);
  const json = await res.json();
  return json?.data ?? json;
}

export async function uploadDocument(
  file: File,
): Promise<{ url: string; key: string; contentType: string; size: number }> {
  const token = authToken();
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${API_URL}/marketplace/uploads/documents`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: form,
  });
  if (!res.ok) throw new Error(`Upload failed (${res.status})`);
  const json = await res.json();
  return json?.data ?? json;
}

// ── Seller listing assembly (media / rooms) ──

export function addListingMedia(
  accountId: string,
  listingId: string,
  body: { url: string; isCover?: boolean; order?: number; caption?: string },
) {
  return post(`/marketplace/accounts/${accountId}/listings/${listingId}/media`, body);
}

export interface RoomInput {
  name: string;
  type?: string;
  lengthFt?: number;
  widthFt?: number;
  description?: string;
  sortOrder?: number;
  media?: Array<{ url: string; caption?: string }>;
}

export function addListingRoom(accountId: string, listingId: string, dto: RoomInput) {
  return post(`/marketplace/accounts/${accountId}/listings/${listingId}/rooms`, dto);
}

/** Create a listing for a marketplace seller account (goes to PENDING_REVIEW). */
export function createListing(
  accountId: string,
  body: {
    purpose: 'RENT' | 'SALE';
    assetType: string;
    title: string;
    description?: string;
    price: number;
    area?: string;
    district?: string;
    bedrooms?: number;
    bathrooms?: number;
    floor?: number;
    areaSqFt?: number;
  },
): Promise<{ id: string }> {
  return post(`/marketplace/accounts/${accountId}/listings`, body);
}

export const ROOM_TYPES = [
  'BEDROOM',
  'MASTER_BEDROOM',
  'BATHROOM',
  'KITCHEN',
  'LIVING_ROOM',
  'DINING_ROOM',
  'BALCONY',
  'SERVANT_ROOM',
  'STORAGE',
  'GARAGE',
  'OTHER',
] as const;

// ── §23 Paid promotions ──

export interface PromotionCatalog {
  currency: string;
  products: Array<{
    type: 'FEATURED' | 'URGENT' | 'TOP_SEARCH';
    rankWeight: number;
    durations: Array<{ days: number; priceBdt: number }>;
  }>;
}

export function getPromotionCatalog(): Promise<PromotionCatalog> {
  return get('/marketplace/promotions/catalog');
}

export function orderPromotion(
  listingId: string,
  body: { type: string; durationDays: number },
): Promise<{ id: string; status: string; amountBdt: number }> {
  return post(`/marketplace/listings/${listingId}/promotions`, body);
}

// ── Renter portal (/renter/*) ──

export interface MyTenancy {
  organization: { slug: string; name: string };
  lease: {
    id: string; status: string;
    startDate: string; endDate: string; monthlyRent: number;
  };
  unit: { name: string; property?: string | null; address?: string | null };
  beneficiaries: Array<{
    owner: string; sharePercent: number; method?: string | null;
    bkashNumber?: string | null; nagadNumber?: string | null;
    bank?: string | null; instructions?: string | null;
  }>;
  outstandingBdt: number;
}

export interface RenterInvoice {
  id: string; invoiceNumber: string; periodKey: string | null;
  status: string; periodStart: string; periodEnd: string;
  totalAmount: number; paidAmount: number; dueDate: string;
  lines: Array<{ id: string; category: string; label: string; amount: number }>;
  payments: Array<{ id: string; status: string; amount: number; receiptNumber: string | null; paidAt: string }>;
}

export interface RenterUtilityAccount {
  id: string; type: string; provider: string | null; scope: string;
  responsibility: string; accountNumber: string | null;
  meters: Array<{
    id: string; meterNumber: string | null;
    readings: Array<{
      id: string; readingDate: string; previousReading: number;
      currentReading: number; consumption: number; photoUrl: string | null;
    }>;
  }>;
}

export interface RenterTicket {
  id: string; title: string; description: string | null; status: string;
  urgency: string; payer: string; estimatedCost: number | null; actualCost: number | null;
  createdAt: string; resolvedAt: string | null;
  workOrders: Array<{ assignedTo: string | null; scheduledDate: string | null; completedAt: string | null; status: string }>;
}

export const getMyRental = () => get<MyTenancy>('/renter/me');
export const getRenterInvoices = () => get<RenterInvoice[]>('/renter/invoices');
export const getRenterUtilities = () => get<RenterUtilityAccount[]>('/renter/utilities');
export const getRenterMaintenance = () => get<RenterTicket[]>('/renter/maintenance');
export const reportRenterPayment = (input: {
  invoiceId: string; method: string; amount: number; reference?: string;
}) => post('/renter/payments', input) as Promise<{ id: string; status: string }>;
export const createRenterTicket = (input: {
  title: string; description?: string;
  urgency?: 'EMERGENCY' | 'URGENT' | 'NORMAL' | 'LOW';
}) => post('/renter/maintenance', input) as Promise<{ id: string; status: string }>;

export interface RenterNotice {
  id: string; title: string; body: string | null; unitId: string | null;
  createdAt: string;
}
export interface RenterDocument {
  id: string; category: string; name: string; fileUrl: string;
  attachedToType: string; createdAt: string;
}

export const getRenterNotices = () => get<RenterNotice[]>('/renter/notices');
export const getRenterDocuments = () => get<RenterDocument[]>('/renter/documents');

export function mapSearch(bounds: {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
  purpose?: ListingPurpose;
  assetType?: string;
  minPrice?: number;
  maxPrice?: number;
}): Promise<MapResult> {
  const qs = new URLSearchParams();
  Object.entries(bounds).forEach(([k, v]) => {
    if (v !== undefined) qs.set(k, String(v));
  });
  return get(`/marketplace/listings/map?${qs.toString()}`);
}
