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
