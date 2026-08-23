/**
 * Integration verification for the hardened provisioning pipeline.
 * Runs against a scratch PostgreSQL instance — safe to re-run.
 */
import { ControlPlanePrismaService } from '../src/infrastructure/control-plane/control-plane-prisma.service';
import { TenantDatabaseManager } from '../src/infrastructure/tenant/tenant-database.manager';
import { ProvisioningService } from '../src/infrastructure/provisioning/provisioning.service';

async function assert(cond: boolean, label: string) {
  if (!cond) throw new Error(`ASSERT FAILED: ${label}`);
  console.log(`  ✅ ${label}`);
}

async function main() {
  const control = new ControlPlanePrismaService();
  await control.onModuleInit();
  const tdm = new TenantDatabaseManager(control);
  const svc = new ProvisioningService(control, tdm);

  // Seed a STARTER plan so subscription creation resolves.
  await control.plan.upsert({
    where: { tier: 'STARTER' },
    create: {
      name: 'Starter',
      tier: 'STARTER',
      description: 'Scratch test plan',
      maxUnits: 5,
      monthlyPriceBdt: 999,
    },
    update: {},
  });

  const input = {
    name: 'Scratch Rahman Properties',
    slug: 'scratch-rahman',
    ownerUserId: 'user_scratch_1',
    ownerName: 'Rahim Uddin',
    ownerEmail: 'rahim@example.com',
    planTier: 'STARTER',
  };

  console.log('\n── Run 1: fresh provisioning ──');
  const r1 = await svc.provisionOrganization(input);
  console.log('RESULT:', JSON.stringify(r1));
  await assert(r1.status === 'COMPLETED', 'provisioning completed');

  const org = await control.saasOrganization.findUniqueOrThrow({
    where: { slug: 'scratch-rahman' },
    include: { database: true, subscription: true, domains: true },
  });
  await assert(org.status === 'ACTIVE', `organization ACTIVE (got ${org.status})`);
  await assert(org.database?.status === 'READY', 'tenant DB READY');
  await assert(!!org.database?.schemaVersion && org.database.schemaVersion !== 'unknown', `schemaVersion recorded (${org.database?.schemaVersion})`);
  await assert(org.subscription?.status === 'ACTIVE', 'subscription created');
  await assert(org.domains.length === 1 && org.domains[0].isPrimary, 'primary domain created');

  // Tenant-side verification through the connection manager.
  const db = await tdm.getTenantDatabase(org.id);
  const members = await db.member.findMany();
  await assert(members.length === 1, `owner member seeded (count=${members.length})`);
  await assert(members[0]?.role === 'ORGANIZATION_OWNER' && members[0]?.status === 'ACTIVE', 'member is active ORGANIZATION_OWNER');
  await assert(members[0]?.centralUserId === input.ownerUserId, 'member bound to central identity');
  const auditRows = await db.tenantAuditEvent.count({ where: { action: 'workspace.provisioned' } });
  await assert(auditRows === 1, 'workspace audit row seeded');

  console.log('\n── Run 2: idempotent re-invocation ──');
  const r2 = await svc.provisionOrganization(input);
  console.log('RESULT:', JSON.stringify(r2));
  await assert(r2.status === 'ALREADY_PROVISIONED', 'second run short-circuits');
  const memberCount = await db.member.count();
  await assert(memberCount === 1, 'no duplicate seed on re-run');

  console.log('\n🎉 Provisioning pipeline verified end-to-end.');

  await tdm.onModuleDestroy();
  await control.$disconnect();
}

main().catch((err) => {
  console.error('❌ VERIFICATION FAILED:', err);
  process.exit(1);
});
