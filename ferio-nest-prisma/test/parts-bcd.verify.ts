/**
 * Integration verification for Parts B/C/D:
 *  - Migration orchestrator applies 0003 to existing tenant
 *  - Ownership share invariant + history (Weeks 10–11)
 *  - Idempotent invoice generation + payment verify/reject/reverse (Weeks 15/19)
 *  - Subscription lifecycle transitions (Week 8 / §15)
 */
import { ControlPlanePrismaService } from '../src/infrastructure/control-plane/control-plane-prisma.service';
import { TenantDatabaseManager } from '../src/infrastructure/tenant/tenant-database.manager';
import { TenantMigrationOrchestrator } from '../src/infrastructure/migrations/tenant-migration-orchestrator';
import { EntitlementService } from '../src/infrastructure/entitlements/entitlement.service';
import { SubscriptionLifecycleService } from '../src/infrastructure/subscriptions/subscription-lifecycle.service';
import { TenantPropertyService } from '../src/features/tenant-operations/tenant-property.service';
import { TenantBillingService } from '../src/features/tenant-operations/tenant-billing.service';
import { TenantLedgerService } from '../src/features/tenant-operations/tenant-ledger.service';
import { TenantWebhookService } from '../src/features/tenant-operations/tenant-webhook.service';

async function assert(cond: boolean, label: string) {
  if (!cond) throw new Error(`ASSERT FAILED: ${label}`);
  console.log(`  ✅ ${label}`);
}

async function main() {
  const control = new ControlPlanePrismaService();
  await control.onModuleInit();
  const tdm = new TenantDatabaseManager(control);
  const orchestrator = new TenantMigrationOrchestrator(control);
  const entitlements = new EntitlementService(control);
  const subscriptions = new SubscriptionLifecycleService(control, tdm, entitlements);
  const propertyService = new TenantPropertyService(tdm, entitlements);
  const ledger = new TenantLedgerService(tdm);
  const webhooks = new TenantWebhookService(tdm, control);
  const billingService = new TenantBillingService(tdm, ledger, webhooks);

  const org = await control.saasOrganization.findUniqueOrThrow({
    where: { slug: 'quota-verify' },
    include: { database: true },
  });
  const orgId = org.id;
  const db = await tdm.getTenantDatabase(orgId);

  // Lift the unit quota left over from entitlements tests, using the
  // normalized PlanEntitlement override path (dogfoods Part 5).
  const starterPlan = await control.plan.findFirstOrThrow({ where: { tier: 'STARTER' } });
  await control.planEntitlement.upsert({
    where: { planId_key: { planId: starterPlan.id, key: 'limit.units' } },
    create: { planId: starterPlan.id, key: 'limit.units', value: '50' },
    update: { value: '50' },
  });
  entitlements.invalidateAll();

  // Seed PRO for the upgrade test.
  await control.plan.upsert({
    where: { tier: 'PRO' },
    create: {
      name: 'Pro', tier: 'PRO', description: 'verify',
      maxUnits: 50, maxProperties: 10, maxBuildings: 10, maxStaff: 10,
      hasUtilities: true, hasMaintenance: true, monthlyPriceBdt: 2999,
    },
    update: {},
  });

  console.log('\n── Migrate tenant to 0003 ──');
  const outcome = await orchestrator.migrateOne(orgId);
  console.log('OUTCOME:', JSON.stringify(outcome));
  await assert(
    ['MIGRATED', 'SKIPPED_UP_TO_DATE'].includes(outcome.status),
    `migration applied (${outcome.status})`,
  );

  // ──────────────────────────────────────────────────────────
  console.log('\n── Part C: Building + unit ownership ──');
  let prop = (await propertyService.listProperties(orgId))[0];
  if (!prop) {
    prop = await propertyService.createProperty(orgId, {
      name: 'Ownership Test Property',
      type: 'RESIDENTIAL_BUILDING',
    });
  }

  const building = await propertyService.createBuilding(orgId, {
    propertyId: prop.id,
    name: 'Tower B',
    totalFloors: 9,
  });
  await assert(!!building.id && building.propertyId === prop.id, 'building created');

  const unit = await propertyService.createUnit(orgId, {
    propertyId: prop.id,
    buildingId: building.id,
    name: 'B-501',
    type: 'APARTMENT' as any,
  });

  const ownerA = await propertyService.addUnitOwner(orgId, unit.id, {
    ownerName: 'Rahim', sharePercent: 60,
  });
  const ownerB = await propertyService.addUnitOwner(orgId, unit.id, {
    ownerName: 'Karim', sharePercent: 40,
  });
  await assert(ownerA.isPrimary === true, 'first owner auto-primary');
  await assert(ownerB.isPrimary === false, 'second owner not primary');

  let over = false;
  try {
    await propertyService.addUnitOwner(orgId, unit.id, {
      ownerName: 'Sneaky', sharePercent: 10,
    });
  } catch { over = true; }
  await assert(over, 'share >100% rejected');

  const summary1 = await propertyService.getUnitOwnershipSummary(orgId, unit.id);
  await assert(summary1.allocatedPercent === 100 && summary1.unallocatedPercent === 0, 'summary math correct');

  const changed = await propertyService.updateUnitOwnerShare(orgId, ownerB.id, 40);
  await assert(changed.sharePercent === 40, 'share change ok');

  await propertyService.updateUnitOwnerPaymentDestination(orgId, ownerA.id, {
    paymentMethod: 'BKASH', bkashNumber: '01712345678',
  });
  const afterPay = await db.unitOwnership.findUnique({ where: { id: ownerA.id } });
  await assert(afterPay?.bkashNumber === '01712345678', 'payment destination saved');

  let lastOwnerGuard = false;
  try {
    await propertyService.endUnitOwnership(orgId, ownerA.id);
    await propertyService.endUnitOwnership(orgId, ownerB.id);
  } catch { lastOwnerGuard = true; }
  await assert(lastOwnerGuard, 'cannot end the final remaining owner');

  // ──────────────────────────────────────────────────────────
  console.log('\n── Part D: Idempotent invoices + payment workflow ──');
  const account = await billingService.getOrCreateBillingAccount(orgId, unit.id);
  if (!account.charges.length) {
    await billingService.addChargeDefinition(orgId, {
      billingAccountId: account.id,
      category: 'RENT' as any, label: 'Monthly Rent', amount: 35000,
      beneficiaryName: 'Rahim+Karim', beneficiaryType: 'UNIT_OWNER',
    });
    await billingService.addChargeDefinition(orgId, {
      billingAccountId: account.id,
      category: 'SERVICE_CHARGE' as any, label: 'Service Charge', amount: 2000,
      beneficiaryName: 'Building Management', beneficiaryType: 'BUILDING_MANAGEMENT',
    });
  }

  const periodStart = '2026-09-01';
  const inv1 = await billingService.generateMonthlyInvoice(orgId, {
    unitId: unit.id, periodStart, periodEnd: '2026-09-30', dueDate: '2026-09-10',
  });
  const inv2 = await billingService.generateMonthlyInvoice(orgId, {
    unitId: unit.id, periodStart, periodEnd: '2026-09-30', dueDate: '2026-09-10',
  });
  await assert(inv1.id === inv2.id, `invoice generation idempotent (${inv1.invoiceNumber})`);
  await assert(inv1.totalAmount === 37000, `total = rent + service charge (${inv1.totalAmount})`);

  const p1 = await billingService.recordPayment(orgId, {
    invoiceId: inv1.id, method: 'BKASH' as any, amount: 10000, proofUrl: 'https://proof.example/x.jpg',
  });
  await assert(p1.status === 'REPORTED', 'payment enters REPORTED (not auto-verified)');

  let overpay = false;
  try {
    await billingService.recordPayment(orgId, {
      invoiceId: inv1.id, method: 'CASH' as any, amount: 999999,
    });
  } catch { overpay = true; }
  await assert(overpay, 'overpayment blocked at record time');

  const v1 = await billingService.verifyPayment(orgId, p1.id, 'staff_manager');
  await assert(v1.status === 'VERIFIED' && !!v1.receiptNumber, `verified with receipt (${v1.receiptNumber})`);

  let mid = await db.invoice.findUnique({ where: { id: inv1.id } });
  await assert(mid!.paidAmount === 10000 && mid!.status === 'PARTIALLY_PAID', 'invoice partially paid');

  const v2 = await billingService.verifyPayment(orgId, p1.id, 'staff_manager');
  await assert(v2.receiptNumber === v1.receiptNumber, 're-verification is a no-op (idempotent)');

  const r1 = await billingService.reversePayment(orgId, p1.id, 'accountant', 'bKash bounced');
  await assert(r1.status === 'REVERSED', 'payment reversed');

  mid = await db.invoice.findUnique({ where: { id: inv1.id } });
  await assert(mid!.paidAmount === 0 && mid!.status !== 'PARTIALLY_PAID', 'invoice allocation rolled back');

  // ──────────────────────────────────────────────────────────
  console.log('\n── Part B: Subscription lifecycle ──');
  const renewed = await subscriptions.renew(orgId);
  await assert(renewed.currentPeriodEnd > new Date(), 'renew extends period into future');

  const cancelled = await subscriptions.cancel(orgId);
  await assert(cancelled.status === 'CANCELLED', 'cancel → CANCELLED');

  const reactivated = await subscriptions.reactivate(orgId);
  await assert(reactivated.status === 'ACTIVE', 'reactivate → ACTIVE with fresh period');

  const planChanged = await subscriptions.changePlan(orgId, 'PRO');
  await assert(planChanged.plan.tier === 'PRO', 'plan change → PRO');

  const events = await control.subscriptionEvent.findMany({
    where: { subscription: { organizationId: orgId } },
    orderBy: { createdAt: 'asc' },
    select: { eventType: true },
  });
  const types = events.map((e) => e.eventType);
  for (const expected of ['RENEWED', 'CANCELLED', 'REACTIVATED', 'UPGRADED']) {
    await assert(types.includes(expected), `audit event written: ${expected}`);
  }

  const scan = await subscriptions.scanForPastDue();
  console.log(`  ℹ️ past-due scan: ${scan.scanned} checked, ${scan.markedPastDue} marked`);

  console.log('\n🎉 Parts B/C/D verified end-to-end.');
  await tdm.onModuleDestroy();
  await control.$disconnect();
}

main().catch((err) => {
  console.error('❌ VERIFICATION FAILED:', err.message ?? err);
  process.exit(1);
});
