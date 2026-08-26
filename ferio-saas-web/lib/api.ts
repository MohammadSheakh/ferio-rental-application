/**
 * Ferio SaaS — Tenant Plane API client
 *
 * Talks to the tenant routes of the three-plane backend. The target
 * organization is carried by `X-Tenant-Slug` — in production the
 * gateway derives it from the subdomain host; the header is the
 * sanctioned dev override (TenantResolverMiddleware).
 */

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:6733/api/v1';

/** Active organization slug — user-selectable, persisted locally. */
export function getActiveTenantSlug(): string {
  if (typeof window !== 'undefined') {
    const stored = window.localStorage.getItem('ferio_tenant_slug');
    if (stored) return stored;
  }
  return process.env.NEXT_PUBLIC_TENANT_SLUG ?? 'quota-verify';
}

export function setActiveTenantSlug(slug: string): void {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem('ferio_tenant_slug', slug);
  }
}

/** Back-compat constant (initial default before a selection is made). */
export const TENANT_SLUG = getActiveTenantSlug();

/** Placeholder actor until §10 auth lands on these routes. */
export const ACTOR_ID = process.env.NEXT_PUBLIC_ACTOR_ID ?? '';

// ── Contracts ──

export type UnitStatus =
  | 'DRAFT'
  | 'AVAILABLE'
  | 'LISTED'
  | 'RESERVED'
  | 'OCCUPIED'
  | 'NOTICE_GIVEN'
  | 'MOVE_OUT_PENDING'
  | 'MAINTENANCE_HOLD'
  | 'BLOCKED';

export interface Property {
  id: string;
  name: string;
  type: string;
  status: string;
  address: string | null;
  area: string | null;
  district: string | null;
  units?: Array<{ id: string }>;
  buildings?: Array<{ id: string }>;
  ownership?: Array<{ id: string; ownerName: string; sharePercent: number }>;
  _count?: { units: number; buildings: number };
}

export interface Unit {
  id: string;
  name: string;
  type: string;
  status: UnitStatus;
  floor: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  areaSqFt: number | null;
  parking: number | null;
  isPublished: boolean;
  marketplaceListingId: string | null;
  property?: { name: string };
  ownership?: Array<{
    id: string;
    ownerName: string;
    sharePercent: number;
    isPrimary: boolean;
    paymentMethod?: string | null;
  }>;
  leases?: Array<{
    id: string;
    status: string;
    renter?: { name: string; phone?: string | null };
  }>;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  periodKey: string | null;
  status: string;
  periodStart: string;
  periodEnd: string;
  totalAmount: number;
  paidAmount: number;
  dueDate: string;
  lines?: Array<{
    id: string;
    category: string;
    label: string;
    amount: number;
    beneficiaryName?: string | null;
    beneficiaryType?: string | null;
  }>;
  billingAccount?: {
    unit?: { name: string; property?: { name: string } };
  };
}

// ── Core fetch ──

/** Central-identity Bearer token, when the operator has signed in. */
function authToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem('ferio_identity');
    return raw ? ((JSON.parse(raw) as { token: string }).token ?? null) : null;
  } catch {
    return null;
  }
}

interface Options {
  actorId?: string;
}

async function request<T>(
  method: 'GET' | 'POST' | 'PATCH',
  path: string,
  body?: unknown,
  opts?: Options,
): Promise<T> {
  const token = authToken();
  const isProduction = process.env.NODE_ENV === 'production';
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(!isProduction ? { 'X-Tenant-Slug': getActiveTenantSlug() } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: 'no-store',
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(
      (detail as { message?: string })?.message ?? `API ${res.status}: ${path}`,
    );
  }
  const envelope = await res.json();
  return (envelope && typeof envelope === 'object' && 'data' in envelope
    ? envelope.data
    : envelope) as T;
}

// ── Identity ──

export interface MyOrganization {
  organizationId: string;
  slug: string;
  name: string;
  memberRole: string;
}

/** Organizations where the signed-in identity holds an ACTIVE membership. */
export async function fetchMyOrganizations(): Promise<MyOrganization[]> {
  try {
    const data = await request<MyOrganization[]>('GET', '/identity/my/organizations');
    return data;
  } catch {
    return [];
  }
}

// ── Properties & Units ──

export const listProperties = () => request<Property[]>('GET', '/tenant/properties');

export const listUnits = (propertyId?: string) =>
  request<Unit[]>(
    'GET',
    `/tenant/units${propertyId ? `?propertyId=${propertyId}` : ''}`,
  );

export const createProperty = (input: {
  name: string;
  type: string;
  address?: string;
  area?: string;
  district?: string;
}) => request<Property>('POST', '/tenant/properties', input);

export const createUnit = (input: {
  propertyId: string;
  buildingId?: string;
  name: string;
  type: string;
  floor?: number;
  bedrooms?: number;
  bathrooms?: number;
  areaSqFt?: number;
}) => request<Unit>('POST', '/tenant/units', input);

export const publishUnit = (
  unitId: string,
  input: { sellerAccountId: string; price: number; purpose?: 'RENT' | 'SALE'; assetType?: string },
) => request<{ queued: boolean }>('POST', `/tenant/units/${unitId}/publish`, input);

export const unpublishUnit = (unitId: string) =>
  request<{ queued: boolean }>('POST', `/tenant/units/${unitId}/unpublish`);

// ── Billing ──

export interface BillingAccount {
  id: string;
  unitId: string;
  charges?: Array<{ id: string; category: string; label: string; amount: number }>;
}

export const getBillingAccount = (unitId: string) =>
  request<BillingAccount>('GET', `/tenant/billing/accounts?unitId=${unitId}`);

export const addChargeDefinition = (input: {
  billingAccountId: string;
  category: string;
  label: string;
  amount: number;
  beneficiaryName?: string;
  beneficiaryType?: string;
}) => request<unknown>('POST', '/tenant/billing/charges', input);

export const generateInvoice = (input: {
  unitId: string;
  periodStart: string;
  periodEnd: string;
  dueDate: string;
}) => request<Invoice>('POST', '/tenant/billing/invoices', input);

export const listInvoices = () => request<Invoice[]>('GET', '/tenant/billing/invoices');

export const recordPayment = (input: {
  invoiceId: string;
  method: string;
  amount: number;
  reference?: string;
  proofUrl?: string;
  notes?: string;
}) => request<{ id: string; status: string }>('POST', '/tenant/billing/payments', input);

export const verifyPayment = (paymentId: string, verifiedBy: string) =>
  request<{ id: string; status: string; receiptNumber?: string | null }>(
    'POST',
    `/tenant/billing/payments/${paymentId}/verify`,
    { verifiedBy },
  );

// ── Operational read models ──

export interface Lease {
  id: string;
  leaseNumber: string;
  status: string;
  monthlyRent: number;
  securityDeposit: number;
  startDate: string;
  endDate: string;
  unit: { name: string; property: { name: string } };
  renter: { name: string; phone?: string | null; email?: string | null };
}

export interface MaintenanceRequest {
  id: string;
  title: string;
  description?: string | null;
  category: string;
  urgency: string;
  status: string;
  estimatedCost?: number | null;
  createdAt: string;
  unit: { name: string; property: { name: string } };
  workOrders: Array<{ id: string; status: string; assignedTo?: string | null }>;
}

export interface UtilityAccount {
  id: string;
  type: string;
  provider?: string | null;
  accountNumber?: string | null;
  scope: string;
  responsibility: string;
  unit?: { name: string; property: { name: string } } | null;
  meters: Array<{
    id: string;
    meterNumber?: string | null;
    readings: Array<{
      id: string;
      previousReading: number;
      currentReading: number;
      consumption: number;
      readingDate: string;
    }>;
  }>;
  bills: Array<{ id: string; totalAmount: number; periodEnd: string; allocationMethod: string }>;
}

export interface CrmLead {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  source: string;
  status: string;
  interestedUnitId?: string | null;
  assignedTo?: string | null;
  updatedAt: string;
}

export const listLeases = () => request<Lease[]>('GET', '/tenant/leases');
export const listMaintenance = () =>
  request<MaintenanceRequest[]>('GET', '/tenant/maintenance');
export const listUtilities = () =>
  request<UtilityAccount[]>('GET', '/tenant/utilities');
export const listCrmLeads = () => request<CrmLead[]>('GET', '/tenant/crm/leads');
