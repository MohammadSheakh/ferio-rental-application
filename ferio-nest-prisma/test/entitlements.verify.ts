/**
 * Integration verification for EntitlementService enforcement:
 * quota limits on property/unit creation + feature gates.
 */
import { ControlPlanePrismaService } from '../src/infrastructure/control-plane/control-plane-prisma.service';
import { TenantDatabaseManager } from '../src/infrastructure/tenant/tenant-database.manager';
import { ProvisioningService } from '../src/infrastructure/provisioning/provisioning.service';
import { EntitlementService } from '../src/infrastructure/entitlements/entitlement.service';
import { TenantPropertyService } from '../src/features/tenant-operations/tenant-property.service';
import { ForbiddenException } from '@nestjs/common';

async function assert(cond: boolean, label: string) {
  if (!cond) throw new Error(`ASSERT FAILED: ${label}`);
  console.log(`  ✅ ${label}`);
}

async function main() {
  const control = new ControlPlanePrismaService();
  await control.onModuleInit();
  const tdm = new TenantDatabaseManager(control);
  const entitlements = new EntitlementService(control);
  const provisioning = new ProvisioningService(control, tdm);
  const propertyService = new TenantPropertyService(tdm, entitlements);

  // STARTER plan = maxUnits 5 / maxProperties 2 by seed defaults.
  await control.plan.upsert({
    where: { tier: 'STARTER' },
    create: {
      name: 'Starter', tier: 'STARTER', description: 'verify',
      maxUnits: 1, maxProperties: 2, monthlyPriceBdt: 999,
    },
    update: { maxUnits: 1, maxProperties: 2 },
  });
  entitlements.invalidateAll?.();

  console.log('\n── Provision tiny-limit organization ──');
  const r = await provisioning.provisionOrganization({
    name: 'Quota Verify Org',
    slug: 'quota-verify',
    ownerUserId: 'user_quota_1',
    ownerName: 'Karim',
    ownerEmail: 'karim@example.com',
    planTier: 'STARTER',
  });
  if (r.status === 'FAILED') throw new Error('provision failed: ' + r.error);
  console.log(`  ✅ provisioned (${r.status})`);

  const orgId =
    r.organizationId ||
    (await control.saasOrganization.findUniqueOrThrow({ where: { slug: 'quota-verify' } })).id;

  console.log('\n── Unit quota (max 1 on this test plan) ──');
  const prop = await propertyService.createProperty(orgId, {
    name: 'Rose Valley', type: 'RESIDENTIAL_BUILDING',
  });
  await propertyService.createUnit(orgId, {
    propertyId: prop.id, name: 'A-1', type: 'APARTMENT',
  });
  await assert(true, 'first unit created');

  let blocked = false;
  try {
    await propertyService.createUnit(orgId, {
      propertyId: prop.id, name: 'A-2', type: 'APARTMENT',
    });
  } catch (e) {
    blocked = e instanceof ForbiddenException;
    console.log('  → blocked with:', (e as Error).message.slice(0, 90));
  }
  await assert(blocked, 'second unit rejected by quota guard');

  console.log('\n── Feature gate (utilities not on STARTER) ──');
  let gated = false;
  try {
    await entitlements.checkFeature(orgId, 'hasUtilities');
  } catch (e) {
    gated = e instanceof ForbiddenException;
  }
  await assert(gated, 'hasUtilities denied on STARTER');

  const e2 = await entitlements.checkQuota(orgId, 'properties', 0).then(() => true).catch(() => false);
  await assert(e2 === true, 'within-quota check passes');

  console.log('\n🎉 Entitlement enforcement verified.');
  await tdm.onModuleDestroy();
  await control.$disconnect();
}

main().catch((err) => {
  console.error('❌ VERIFICATION FAILED:', err.message ?? err);
  process.exit(1);
});
