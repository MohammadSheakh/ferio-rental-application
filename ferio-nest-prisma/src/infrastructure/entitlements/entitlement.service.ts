import { Injectable, ForbiddenException } from '@nestjs/common';
import { ControlPlanePrismaService } from '../control-plane/control-plane-prisma.service';

export type QuotaResource = 'units' | 'properties' | 'buildings' | 'staff';
export type FeatureKey =
  | 'hasUtilities'
  | 'hasMaintenance'
  | 'hasAutomation'
  | 'hasApiAccess'
  | 'hasCustomDomain'
  | 'hasWhatsApp'
  | 'hasAdvancedReports';

export interface OrganizationEntitlements {
  status: string;
  tier: string;
  maxUnits: number;
  maxProperties: number;
  maxBuildings: number;
  maxStaff: number;
  maxStorageMb: number;
  hasUtilities: boolean;
  hasMaintenance: boolean;
  hasAutomation: boolean;
  hasApiAccess: boolean;
  hasCustomDomain: boolean;
  hasWhatsApp: boolean;
  hasAdvancedReports: boolean;
  /** Arbitrary extra entitlements from PlanEntitlement rows. */
  extras: Record<string, string>;
}

/** Short-lived in-process cache — plan changes propagate within a minute. */
interface CacheEntry {
  entitlements: OrganizationEntitlements;
  expiresAt: number;
}

/**
 * Entitlement Service
 *
 * Central authority for plan limits and feature access (§2.3 Control
 * Plane). Every quota/feature decision in the tenant plane MUST go
 * through this service rather than reading Plan columns ad hoc.
 *
 * Resolution order:
 *   1. Active subscription's plan
 *   2. Fallback FREE_LISTING plan (marketplace-only accounts)
 *   3. Hardcoded safe minimums
 *
 * PlanEntitlement rows override the flat Plan columns per key.
 */
@Injectable()
export class EntitlementService {
  private static readonly CACHE_TTL_MS = 60_000;
  private readonly cache = new Map<string, CacheEntry>();

  constructor(private readonly controlPlane: ControlPlanePrismaService) {}

  /** Invalidate a cached org after plan/subscription mutations. */
  invalidate(organizationId: string): void {
    this.cache.delete(organizationId);
  }

  /** Flush the entire cache (e.g. after bulk plan edits). */
  invalidateAll(): void {
    this.cache.clear();
  }

  async getOrganizationEntitlements(
    organizationId: string,
  ): Promise<OrganizationEntitlements> {
    const cached = this.cache.get(organizationId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.entitlements;
    }

    const subscription = await this.controlPlane.subscription.findUnique({
      where: { organizationId },
      include: { plan: { include: { entitlements: true } } },
    });

    let base: Omit<OrganizationEntitlements, 'extras'>;
    if (!subscription) {
      const freePlan = await this.controlPlane.plan.findFirst({
        where: { tier: 'FREE_LISTING' },
        include: { entitlements: true },
      });
      base = {
        status: 'ACTIVE',
        tier: freePlan?.tier ?? 'FREE_LISTING',
        maxUnits: freePlan?.maxUnits ?? 0,
        maxProperties: freePlan?.maxProperties ?? 0,
        maxBuildings: freePlan?.maxBuildings ?? 0,
        maxStaff: freePlan?.maxStaff ?? 0,
        maxStorageMb: freePlan?.maxStorageMb ?? 50,
        hasUtilities: false,
        hasMaintenance: false,
        hasAutomation: false,
        hasApiAccess: false,
        hasCustomDomain: false,
        hasWhatsApp: false,
        hasAdvancedReports: false,
      };
      const entitlements: OrganizationEntitlements = {
        ...base,
        extras: this.extrasFrom(freePlan?.entitlements),
      };
      return this.cacheAndReturn(organizationId, entitlements);
    }

    base = {
      status: subscription.status,
      tier: subscription.plan.tier,
      maxUnits: subscription.plan.maxUnits,
      maxProperties: subscription.plan.maxProperties,
      maxBuildings: subscription.plan.maxBuildings,
      maxStaff: subscription.plan.maxStaff,
      maxStorageMb: subscription.plan.maxStorageMb,
      hasUtilities: subscription.plan.hasUtilities,
      hasMaintenance: subscription.plan.hasMaintenance,
      hasAutomation: subscription.plan.hasAutomation,
      hasApiAccess: subscription.plan.hasApiAccess,
      hasCustomDomain: subscription.plan.hasCustomDomain,
      hasWhatsApp: subscription.plan.hasWhatsApp,
      hasAdvancedReports: subscription.plan.hasAdvancedReports,
    };

    // Normalized rows may extend or override flat columns.
    for (const [key, raw] of Object.entries(
      this.extrasFrom(subscription.plan.entitlements),
    )) {
      this.applyExtra(base, key, raw);
    }

    return this.cacheAndReturn(organizationId, {
      ...base,
      extras: this.extrasFrom(subscription.plan.entitlements),
    });
  }

  /**
   * Assert the organization may create one more unit of `resource`.
   * `currentCount` is supplied by the caller (tenant-DB scoped count).
   */
  async checkQuota(
    organizationId: string,
    resource: QuotaResource,
    currentCount: number,
  ): Promise<void> {
    const e = await this.getOrganizationEntitlements(organizationId);

    if (e.status === 'SUSPENDED' || e.status === 'CANCELLED') {
      throw new ForbiddenException(
        `Organization subscription is ${e.status.toLowerCase()}`,
      );
    }
    if (e.status !== 'ACTIVE' && e.status !== 'TRIALING') {
      throw new ForbiddenException(
        `Organization is ${e.status.toLowerCase()} — creation blocked`,
      );
    }

    const extrasRaw = e.extras[`limit.${resource}`];
    const limit =
      extrasRaw !== undefined
        ? parseInt(extrasRaw, 10)
        : (((e as any)[this.limitField(resource)] as number | undefined) ?? 0);

    if (currentCount >= limit) {
      throw new ForbiddenException(
        `Plan quota exceeded for ${resource}: ${currentCount}/${limit} on ${e.tier}. Upgrade to add more.`,
      );
    }
  }

  /** Assert an organization's plan includes a named feature. */
  async checkFeature(
    organizationId: string,
    feature: FeatureKey,
  ): Promise<OrganizationEntitlements> {
    const e = await this.getOrganizationEntitlements(organizationId);

    if (e.status === 'SUSPENDED' || e.status === 'CANCELLED') {
      throw new ForbiddenException(
        `Organization subscription is ${e.status.toLowerCase()}`,
      );
    }
    if (!(e as any)[feature] && e.extras[`feature.${feature}`] !== 'true') {
      throw new ForbiddenException(
        `${feature} is not available on the ${e.tier} plan. Please upgrade your subscription.`,
      );
    }
    return e;
  }

  // ────────────────────────────────────────────────────────────

  private limitField(resource: QuotaResource): string {
    const map: Record<QuotaResource, string> = {
      units: 'maxUnits',
      properties: 'maxProperties',
      buildings: 'maxBuildings',
      staff: 'maxStaff',
    };
    return map[resource];
  }

  private extrasFrom(
    rows?: Array<{ key: string; value: string }>,
  ): Record<string, string> {
    if (!rows?.length) return {};
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  }

  private applyExtra(
    target: Record<string, unknown>,
    key: string,
    raw: string,
  ): void {
    if (key.startsWith('feature.')) {
      target[key.slice('feature.'.length)] = raw === 'true';
      return;
    }
    if (key.startsWith('limit.')) {
      const field = this.limitField(
        key.slice('limit.'.length) as QuotaResource,
      );
      if (field) target[field] = parseInt(raw, 10);
      return;
    }
    // Unknown keys stay in extras only.
  }

  private cacheAndReturn(
    organizationId: string,
    e: OrganizationEntitlements,
  ): OrganizationEntitlements {
    this.cache.set(organizationId, {
      entitlements: e,
      expiresAt: Date.now() + EntitlementService.CACHE_TTL_MS,
    });
    return e;
  }
}
