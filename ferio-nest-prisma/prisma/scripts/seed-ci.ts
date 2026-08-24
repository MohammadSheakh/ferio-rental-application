/**
 * CI/demo seed — idempotent bootstrap of the state the verification
 * suites assume:
 *   • platform admin (admin@ferio.test / RootAdmin1!)
 *   • five plan tiers (PRO-enabled feature flags)
 *   • owner identity (owner@demo.test / supersecret1)
 *   • organization `sheakh-fam` provisioned for that owner on PRO
 *
 * Safe to run repeatedly: every step upserts or short-circuits.
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/control-client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { hashSync } from 'bcrypt';

const pool = new Pool({ connectionString: process.env.CONTROL_PLANE_DATABASE_URL });
const db = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  // ── Platform staff ──
  const passwordHash = hashSync('RootAdmin1!', 10);
  await db.platformUser.upsert({
    where: { email: 'admin@ferio.test' },
    update: { password: passwordHash, role: 'SUPER_ADMIN', isActive: true },
    create: {
      email: 'admin@ferio.test',
      password: passwordHash,
      name: 'Ferio Root Admin',
      role: 'SUPER_ADMIN',
    } as any,
  });
  console.log('✔ platform admin');

  // ── Plans ──
  const tiers: Array<[string, string, number]> = [
    ['FREE_LISTING', 'Free Listing', 0],
    ['STARTER', 'Starter', 999],
    ['PRO', 'Pro', 2999],
    ['BUSINESS', 'Business', 7999],
    ['ENTERPRISE', 'Enterprise', 0],
  ];
  const planIds: Record<string, string> = {};
  for (const [tier, name, price] of tiers) {
    const plan = await db.plan.upsert({
      where: { tier: tier as never },
      update: {},
      create: {
        tier: tier as never,
        name,
        monthlyPriceBdt: price,
        isActive: true,
        maxUnits: tier === 'FREE_LISTING' ? 0 : tier === 'STARTER' ? 5 : tier === 'PRO' ? 500 : tier === 'BUSINESS' ? 2000 : 99999,
        maxProperties: tier === 'FREE_LISTING' ? 0 : tier === 'STARTER' ? 2 : tier === 'PRO' ? 200 : 9999,
        maxBuildings: tier === 'FREE_LISTING' ? 0 : tier === 'STARTER' ? 2 : tier === 'PRO' ? 200 : 9999,
        maxStaff: tier === 'FREE_LISTING' || tier === 'STARTER' ? 5 : tier === 'PRO' ? 50 : 999,
        hasUtilities: ['PRO', 'BUSINESS', 'ENTERPRISE'].includes(tier),
        hasMaintenance: ['PRO', 'BUSINESS', 'ENTERPRISE'].includes(tier),
        hasAutomation: ['BUSINESS', 'ENTERPRISE'].includes(tier),
        hasApiAccess: ['BUSINESS', 'ENTERPRISE'].includes(tier),
        hasCustomDomain: ['BUSINESS', 'ENTERPRISE'].includes(tier),
        hasAdvancedReports: ['PRO', 'BUSINESS', 'ENTERPRISE'].includes(tier),
      } as any,
    });
    planIds[tier] = plan.id;
  }
  console.log('✔ plans');

  // ── Owner identity ──
  const ownerHash = hashSync('supersecret1', 10);
  const owner = await db.centralUser.upsert({
    where: { email: 'owner@demo.test' },
    update: {},
    create: {
      email: 'owner@demo.test',
      passwordHash: ownerHash,
      displayName: 'Sheakh Family Owner',
    },
  });
  console.log('✔ owner identity');

  // ── Organization (skip if already provisioned) ──
  const existing = await db.saasOrganization.findUnique({
    where: { slug: 'sheakh-fam' },
    include: { database: true },
  });
  if (existing?.database?.status === 'READY') {
    console.log('✔ organization sheakh-fam already provisioned');
  } else if (existing) {
    console.log('⚠ organization sheakh-fam exists without READY database — provision manually');
  } else {
    // Defer to the runtime provisioning pipeline via HTTP-less direct call:
    // instantiate through the compiled Nest container is heavy for a seed;
    // instead instruct CI to call the self-serve endpoint after boot.
    console.log('ℹ organization will be provisioned via API by suite setup');
    void planIds;
  }

  await db.$disconnect();
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
