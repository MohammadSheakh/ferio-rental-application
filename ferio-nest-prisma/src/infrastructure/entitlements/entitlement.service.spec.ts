import { ForbiddenException } from '@nestjs/common';
import { EntitlementService } from './entitlement.service';

/** Minimal stub of ControlPlanePrismaService for pure-logic testing. */
function makeControlPlane(
  overrides: {
    subscription?: any;
    freePlan?: any;
  } = {},
) {
  return {
    subscription: {
      findUnique: jest.fn().mockResolvedValue(overrides.subscription ?? null),
    },
    plan: {
      findFirst: jest.fn().mockResolvedValue(overrides.freePlan ?? null),
    },
  } as any;
}

const STARTER_SUB = (
  planOverrides: Partial<Record<string, unknown>> = {},
  extras: any[] = [],
) => ({
  status: 'ACTIVE',
  plan: {
    tier: 'STARTER',
    maxUnits: 5,
    maxProperties: 2,
    maxBuildings: 2,
    maxStaff: 2,
    maxStorageMb: 500,
    hasUtilities: false,
    hasMaintenance: false,
    hasAutomation: false,
    hasApiAccess: false,
    hasCustomDomain: false,
    hasWhatsApp: false,
    hasAdvancedReports: false,
    ...planOverrides,
    entitlements: extras,
  },
});

describe('EntitlementService', () => {
  it('returns plan entitlements for a subscribed organization', async () => {
    const svc = new EntitlementService(
      makeControlPlane({
        subscription: STARTER_SUB(),
      }),
    );

    const e = await svc.getOrganizationEntitlements('org_1');
    expect(e.tier).toBe('STARTER');
    expect(e.maxUnits).toBe(5);
    expect(e.hasUtilities).toBe(false);
  });

  it('falls back to FREE_LISTING minimums without a subscription', async () => {
    const svc = new EntitlementService(
      makeControlPlane({
        freePlan: {
          tier: 'FREE_LISTING',
          maxUnits: 0,
          maxProperties: 0,
          maxBuildings: 0,
          maxStaff: 0,
          maxStorageMb: 50,
        },
      }),
    );

    const e = await svc.getOrganizationEntitlements('org_free');
    expect(e.tier).toBe('FREE_LISTING');
    expect(e.maxUnits).toBe(0);
  });

  describe('checkQuota', () => {
    it('passes under the limit and throws at the limit', async () => {
      const svc = new EntitlementService(
        makeControlPlane({
          subscription: STARTER_SUB({ maxUnits: 3 }),
        }),
      );

      await expect(svc.checkQuota('o', 'units', 2)).resolves.toBeUndefined();
      await expect(svc.checkQuota('o', 'units', 3)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('blocks suspended organizations outright', async () => {
      const svc = new EntitlementService(
        makeControlPlane({
          subscription: STARTER_SUB({}, []),
        }),
      );
      // Force suspended status on the cached shape
      (svc as any).cache.set('o', {
        expiresAt: Date.now() + 60_000,
        entitlements: {
          status: 'SUSPENDED',
          tier: 'STARTER',
          maxUnits: 10,
          maxProperties: 10,
          maxBuildings: 10,
          maxStaff: 10,
          maxStorageMb: 1,
          hasUtilities: true,
          hasMaintenance: true,
          hasAutomation: true,
          hasApiAccess: true,
          hasCustomDomain: true,
          hasWhatsApp: true,
          hasAdvancedReports: true,
          extras: {},
        },
      });
      await expect(svc.checkQuota('o', 'units', 0)).rejects.toThrow(
        /suspended/i,
      );
    });
  });

  describe('PlanEntitlement overrides', () => {
    it('feature.<key>=true rows unlock features not on the flat columns', async () => {
      const svc = new EntitlementService(
        makeControlPlane({
          subscription: STARTER_SUB({}, [
            { key: 'feature.hasUtilities', value: 'true' },
          ]),
        }),
      );

      await expect(
        svc.checkFeature('o', 'hasUtilities'),
      ).resolves.toBeDefined();
    });

    it('limit.<resource> rows override flat limits', async () => {
      const svc = new EntitlementService(
        makeControlPlane({
          subscription: STARTER_SUB({ maxUnits: 100 }, [
            { key: 'limit.units', value: '7' },
          ]),
        }),
      );

      await expect(svc.checkQuota('o', 'units', 6)).resolves.toBeUndefined();
      await expect(svc.checkQuota('o', 'units', 7)).rejects.toThrow(/7/);
    });
  });

  it('caches lookups per organization', async () => {
    const cp = makeControlPlane({ subscription: STARTER_SUB() });
    const svc = new EntitlementService(cp);

    await svc.getOrganizationEntitlements('cached');
    await svc.getOrganizationEntitlements('cached');
    expect(cp.subscription.findUnique).toHaveBeenCalledTimes(1);

    svc.invalidate('cached');
    await svc.getOrganizationEntitlements('cached');
    expect(cp.subscription.findUnique).toHaveBeenCalledTimes(2);
  });
});
