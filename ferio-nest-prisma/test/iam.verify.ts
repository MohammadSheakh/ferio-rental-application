/**
 * Integration verification for SaaS IAM (invites/members) AND the
 * TenantMigrationOrchestrator (applies the MemberInvite table first).
 */
import { ControlPlanePrismaService } from '../src/infrastructure/control-plane/control-plane-prisma.service';
import { TenantDatabaseManager } from '../src/infrastructure/tenant/tenant-database.manager';
import { TenantMigrationOrchestrator } from '../src/infrastructure/migrations/tenant-migration-orchestrator';
import { EntitlementService } from '../src/infrastructure/entitlements/entitlement.service';
import { TenantIamService } from '../src/features/tenant-operations/tenant-iam.service';
import { MemberRole } from '@prisma/tenant-client';

async function assert(cond: boolean, label: string) {
  if (!cond) throw new Error(`ASSERT FAILED: ${label}`);
  console.log(`  ✅ ${label}`);
}

async function main() {
  const control = new ControlPlanePrismaService();
  await control.onModuleInit();
  const tdm = new TenantDatabaseManager(control);
  const orchestrator = new TenantMigrationOrchestrator(control);
  const iam = new TenantIamService(tdm, new EntitlementService(control));

  const org = await control.saasOrganization.findUniqueOrThrow({
    where: { slug: 'quota-verify' },
  });
  const OWNER = org.ownerUserId;

  console.log('\n── Orchestrator: migrate existing tenant to latest template ──');
  const outcome = await orchestrator.migrateOne(org.id);
  console.log('OUTCOME:', JSON.stringify(outcome));
  await assert(
    outcome.status === 'MIGRATED' || outcome.status === 'SKIPPED_UP_TO_DATE',
    `orchestrator migrated tenant (${outcome.status})`,
  );

  console.log('\n── IAM: invite lifecycle ──');
  const invite = await iam.createInvite(org.id, OWNER, {
    email: 'sultana@example.com',
    role: MemberRole.ACCOUNTANT,
  });
  await assert(!!invite.token && invite.token.length >= 32, 'invite created with secure token');

  // Non-admin cannot invite.
  let forbidden = false;
  try {
    await iam.createInvite(org.id, 'not-a-member', {
      email: 'x@example.com',
      role: MemberRole.VIEWER,
    });
  } catch (e) {
    forbidden = true;
  }
  await assert(forbidden, 'non-member blocked from inviting');

  // Owner seat not assignable via invite.
  let ownerBlocked = false;
  try {
    await iam.createInvite(org.id, OWNER, {
      email: 'owner@example.com',
      role: MemberRole.ORGANIZATION_OWNER,
    });
  } catch {
    ownerBlocked = true;
  }
  await assert(ownerBlocked, 'ORGANIZATION_OWNER not assignable via invite');

  console.log('\n── IAM: acceptance ──');
  const acc = await iam.acceptInvite(org.id, {
    token: invite.token,
    centralUserId: 'user_sultana_1',
    displayName: 'Sultana Rahman',
  });
  await assert(acc.accepted && acc.role === 'ACCOUNTANT', 'invite accepted with correct role');

  // Token single-use.
  let reused = false;
  try {
    await iam.acceptInvite(org.id, {
      token: invite.token,
      centralUserId: 'user_other_1',
      displayName: 'Other',
    });
  } catch {
    reused = true;
  }
  await assert(reused, 'token is single-use');

  const members = await iam.listMembers(org.id);
  await assert(members.length === 2, `members list correct (count=${members.length})`);
  const sultana = members.find((m) => m.centralUserId === 'user_sultana_1');
  await assert(sultana?.status === 'ACTIVE' && sultana?.role === 'ACCOUNTANT', 'member ACTIVE/ACCOUNTANT');

  console.log('\n🎉 IAM + migration orchestrator verified.');
  await tdm.onModuleDestroy();
  await control.$disconnect();
}

main().catch((err) => {
  console.error('❌ VERIFICATION FAILED:', err.message ?? err);
  process.exit(1);
});
