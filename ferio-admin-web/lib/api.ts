/**
 * Ferio Platform Admin — Control Plane API client
 *
 * All routes live under the `platform/` namespace of the backend.
 * Moderator/admin identity is carried by `x-actor-id` until the §10
 * platform-auth guard replaces it.
 */

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:6733/api/v1';

export const ACTOR_ID = process.env.NEXT_PUBLIC_ACTOR_ID ?? 'platform-admin';

// ── Contracts ──

export interface Organization {
  id: string;
  name: string;
  slug: string;
  status: string;
  contactEmail: string | null;
  createdAt: string;
  database?: {
    status: string;
    databaseName: string;
    isHealthy: boolean;
    schemaVersion?: string | null;
    lastMigratedAt?: string | null;
  } | null;
  subscription?: {
    status: string;
    plan: { name: string; tier: string };
    currentPeriodEnd: string;
  } | null;
  domains?: Array<{ domain: string; isPrimary: boolean }>;
}

export interface TenantDbRow {
  organizationId: string;
  databaseName: string;
  status: string;
  schemaVersion: string | null;
  lastMigratedAt: string | null;
  lastHealthCheck: string | null;
  isHealthy: boolean;
  host: string;
  port: number;
}

export interface PendingListing {
  id: string;
  title: string;
  price: number;
  purpose: string;
  assetType: string;
  area: string | null;
  district: string | null;
  updatedAt: string;
  seller: {
    displayName: string | null;
    accountType: string | null;
    isIdentityVerified: boolean;
  };
  media?: Array<{ url: string; isCover: boolean }>;
  _count?: { inquiries: number };
}

export interface Plan {
  id: string;
  name: string;
  tier: string;
  monthlyPriceBdt: number;
  maxUnits: number;
  isActive: boolean;
}

export interface FeatureFlag {
  id: string;
  key: string;
  isEnabled: boolean;
  description: string | null;
}

export interface PlatformHealth {
  status: string;
  controlPlane: { totalOrganizations: number; activeOrganizations: number };
  tenantDatabases: { total: number; ready: number; healthy: number; failed: number };
  connectionPool: { activeConnections: number; maxPoolSize: number };
}

interface BatchMigrationReport {
  total: number;
  migrated: number;
  skippedUpToDate: number;
  failed: number;
  outcomes: Array<{
    slug: string;
    status: string;
    schemaVersion?: string;
    error?: string;
  }>;
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

async function request<T>(
  method: 'GET' | 'POST' | 'PATCH',
  path: string,
  body?: unknown,
): Promise<T> {
  const token = authToken();
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
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

// ── Organizations & provisioning ──

export const listOrganizations = () =>
  request<Organization[]>('GET', '/platform/organizations');

export const provisionOrganization = (input: {
  name: string;
  slug: string;
  ownerUserId: string;
  ownerName: string;
  ownerEmail: string;
  planTier?: string;
}) =>
  request<{ status: string; domain: string; schemaVersion?: string }>(
    'POST',
    '/platform/organizations',
    input,
  );

export const retryProvisioning = (organizationId: string) =>
  request<{ status: string }>(
    'POST',
    `/platform/organizations/${organizationId}/provisioning/retry`,
    {},
  );

export const suspendOrganization = (organizationId: string) =>
  request<unknown>('PATCH', `/platform/organizations/${organizationId}/suspend`);

// ── Tenant databases & migrations ──

export const listTenantDbs = () => request<TenantDbRow[]>('GET', '/platform/tenant-db');

export const migrateTenant = (organizationId: string) =>
  request<{ status: string; schemaVersion?: string }>('POST', '/platform/tenant-db/migrate', {
    organizationId,
  });

export const migrateFleet = () =>
  request<BatchMigrationReport>('POST', '/platform/tenant-db/migrate', { all: true });

// ── Marketplace moderation ──

export const listPendingListings = () =>
  request<PendingListing[]>('GET', '/platform/marketplace/listings/pending-review');

export const approveListing = (listingId: string) =>
  request<unknown>('POST', `/platform/marketplace/listings/${listingId}/approve`, {});

export const rejectListing = (listingId: string, reason: string) =>
  request<unknown>('POST', `/platform/marketplace/listings/${listingId}/reject`, { reason });

// ── Plans / flags / health ──

export const listPlans = () => request<Plan[]>('GET', '/platform/plans');
export const seedPlans = () => request<{ seeded: number }>('POST', '/platform/plans/seed', {});
export const listFeatureFlags = () => request<FeatureFlag[]>('GET', '/platform/feature-flags');
export const getHealth = () => request<PlatformHealth>('GET', '/platform/health');

// ── Staff TOTP (self-service) ──

export const totpStatus = () =>
  request<{ enabled: boolean }>('GET', '/identity/platform/totp/status');
export const totpSetup = () =>
  request<{ secret: string; otpauthUri: string }>('POST', '/identity/platform/totp/setup', {});
export const totpConfirm = (code: string) =>
  request<{ enabled: boolean }>('POST', '/identity/platform/totp/confirm', { code });
export const totpDisable = (code: string) =>
  request<{ enabled: boolean }>('POST', '/identity/platform/totp/disable', { code });
