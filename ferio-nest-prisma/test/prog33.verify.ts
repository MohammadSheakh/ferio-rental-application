/**
 * prog-33 verification — § Weeks 20–21 maintenance workflow depth
 * (triage → estimate → approval → work → confirmation/reopen) and
 * § Weeks 34–35 analytics (marketplace trends, growth/churn, payment behavior).
 */
const B = process.env.API_BASE ?? 'http://localhost:6799/api/v1';
let pass = 0, fail = 0;
const ok = (l: string) => { pass++; console.log(`  ✅ ${l}`); };
const bad = (l: string, d?: unknown) => { fail++; console.log(`  ❌ ${l}${d !== undefined ? ' → ' + String(d).slice(0, 170) : ''}`); };

async function req(method: string, path: string, o: { token?: string; slug?: string; body?: unknown } = {}) {
  const res = await fetch(`${B}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(o.token ? { Authorization: `Bearer ${o.token}` } : {}),
      ...(o.slug ? { 'X-Tenant-Slug': o.slug } : {}),
    },
    body: o.body === undefined ? undefined : JSON.stringify(o.body),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, ...json };
}
const d = (r: any) => r?.data;
function m(r: any) { return r?.message ?? JSON.stringify(r)?.slice(0, 130); }
let r: any;
const TAG = Date.now() % 100000;

async function main() {
  const owner = d(await req('POST', '/identity/login', { body: { email: 'owner@demo.test', password: 'supersecret1' } }));
  const H = { token: owner.token, slug: 'sheakh-fam' };
  const staffId = d(await req('GET', '/identity/me', { token: owner.token }))?.userId;

  console.log('\n═══ A. Maintenance workflow: triage → estimate gate ═══');

  const props = d(await req('GET', '/tenant/properties', H));
  const unit = d(await req('POST', '/tenant/units', {
    ...H, body: { propertyId: props[0].id, name: `WF-${TAG}`, type: 'APARTMENT', floor: 2, bedrooms: 2, bathrooms: 1 },
  }));
  r = await req('POST', '/tenant/maintenance', {
    ...H,
    body: { unitId: unit.id, scope: 'UNIT', title: `AC dead ${TAG}`, urgency: 'URGENT', payer: 'UNIT_OWNER' },
  });
  const ticket = d(r);
  ticket?.id && ticket.status === 'OPEN' ? ok('ticket OPEN') : bad('create ticket', m(r));

  // Triage with estimate first (the approval-gated path)
  r = await req('POST', `/tenant/maintenance/${ticket.id}/triage`, {
    ...H, body: { urgency: 'EMERGENCY', payer: 'UNIT_OWNER', estimateAmount: 12000, estimateNote: 'Compressor replacement' },
  });
  d(r)?.status === 'TRIAGED' && d(r)?.approvalStatus === 'PENDING'
    ? ok('triaged w/ estimate (approval PENDING)')
    : bad('triage', m(r));

  // Assignment blocked while the estimate is pending
  r = await req('POST', '/tenant/maintenance/work-orders', {
    ...H, body: { requestId: ticket.id, assignedTo: 'Early Crew' },
  });
  r.status === 400 ? ok('assignment blocked while estimate pending (400)') : bad('pre-approval guard', `${r.status} ${m(r)}`);

  // Approve → assign works
  r = await req('POST', `/tenant/maintenance/${ticket.id}/estimate`, {
    ...H, body: { decision: 'APPROVE', decidedBy: staffId },
  });
  d(r)?.approvalStatus === 'APPROVED' ? ok('estimate APPROVED') : bad('approve', m(r));

  r = await req('POST', '/tenant/maintenance/work-orders', {
    ...H, body: { requestId: ticket.id, assignedTo: 'CoolFix Ltd', cost: 12000 },
  });
  const wo = d(r);
  wo?.id && wo.estimatedCost === 12000 ? ok('work order assigned (carries estimate)') : bad('assign post-approval', m(r));

  // Illegal transition: ASSIGNED → CONFIRMED must fail
  r = await req('PATCH', `/tenant/maintenance/${ticket.id}/status`, {
    ...H, body: { status: 'CONFIRMED' },
  });
  r.status === 400 ? ok('state machine blocks ASSIGNED→CONFIRMED (400)') : bad('transition guard', `${r.status} ${m(r)}`);

  console.log('\n═══ B. Completion → renter confirm / reopen ═══');
  r = await req('PATCH', `/tenant/maintenance/work-orders/${wo.id}/complete`, {
    ...H, body: { cost: 13500, afterPhotoUrl: 'https://img.ferio.test/ac-fixed.png' },
  });
  d(r)?.status === 'COMPLETED' ? ok('work completed at actual ৳13,500') : bad('complete', m(r));
  const refreshed = d(await req('GET', '/tenant/maintenance?unitId=' + unit.id, H))?.find((x: any) => x.id === ticket.id);
  refreshed?.status === 'RESOLVED' ? ok('request RESOLVED') : bad('resolved state', refreshed?.status);

  // Renter-side confirm — need an identity-bound renter on this unit
  const renterTok =
    d(await req('POST', '/identity/register', { body: { email: `wfrenter${TAG}@demo.test`, password: 'supersecret1', displayName: 'Waseem Renter' } }))?.token ||
    d(await req('POST', '/identity/login', { body: { email: `wfrenter${TAG}@demo.test`, password: 'supersecret1' } }))?.token;
  const renterUid = d(await req('GET', '/identity/me', { token: renterTok }))?.userId;
  const renterRow = d(await req('POST', '/tenant/renters', {
    ...H, body: { name: 'Waseem Renter', phone: '01777999888', centralUserId: renterUid },
  }));
  r = await req('POST', '/tenant/leases', {
    ...H, body: { unitId: unit.id, renterId: renterRow.id, startDate: '2027-02-01', endDate: '2028-01-31', monthlyRent: 30000 },
  });
  d(r)?.status === 'ACTIVE' ? ok('identity-bound ACTIVE lease for renter') : bad('lease', m(r));

  // Renter reopens first
  r = await req('POST', `/renter/maintenance/${ticket.id}/reopen`, {
    token: renterTok, body: { reason: 'AC still not cooling after two days' },
  });
  d(r)?.status === 'REOPENED' && d(r)?.reopenCount === 1
    ? ok('renter reopened w/ reason (REOPENED, count=1)')
    : bad('reopen', m(r));

  // Staff pushes back to RESOLVED via guarded transition, renter confirms
  r = await req('PATCH', `/tenant/maintenance/${ticket.id}/status`, {
    ...H, body: { status: 'IN_PROGRESS' },
  });
  r.status === 200 || r.status === 201 ? null : bad('REOPENED→IN_PROGRESS', m(r));
  await req('PATCH', `/tenant/maintenance/${ticket.id}/status`, { ...H, body: { status: 'RESOLVED' } });

  r = await req('POST', `/renter/maintenance/${ticket.id}/confirm`, { token: renterTok });
  d(r)?.status === 'CONFIRMED' && d(r)?.renterConfirmedAt
    ? ok('renter confirmed → CONFIRMED')
    : bad('confirm', m(r));

  r = await req('PATCH', `/tenant/maintenance/${ticket.id}/status`, { ...H, body: { status: 'CLOSED' } });
  d(r)?.status === 'CLOSED' ? ok('staff closed the ticket') : bad('close', m(r));

  console.log('\n═══ C. Analytics (§ Weeks 34–35) ═══');
  const staff = d(await req('POST', '/identity/platform/login', {
    body: { email: 'admin@ferio.test', password: 'RootAdmin1!' },
  }));

  // Generate search activity
  await req('GET', '/marketplace/listings/search?area=Gulshan&purpose=RENT');
  await req('GET', '/marketplace/listings/search?area=Rampura&purpose=SALE');
  await req('GET', '/marketplace/listings/map?minLat=23.7&maxLat=23.85&minLng=90.35&maxLng=90.45');
  await sleep(600);

  r = await req('GET', '/platform/analytics/marketplace', { token: staff.token });
  const mk = d(r);
  mk?.listingVolumeByMonth && Object.keys(mk.listingVolumeByMonth).length > 0 &&
  Array.isArray(mk?.priceRanges) &&
  mk?.searchActivity?.weekly
    ? ok(`marketplace analytics live (${mk.totals.all} listings · ${Object.keys(mk.propertyTypeTrends).length} type trends · weekly search buckets)`)
    : bad('marketplace analytics', JSON.stringify(mk)?.slice(0, 150));

  mk?.areaDemand?.length >= 1
    ? ok(`area demand computed (top: ${mk.areaDemand[0].area} · ${mk.areaDemand[0].inquiries} inquiries)`)
    : bad('area demand', 'no rows');
  const range = mk?.priceRanges?.find((x: any) => x.assetType === 'APARTMENT');
  range ? ok(`price ranges live (APARTMENT median ৳${range.median})`) : bad('ranges', 'none');

  r = await req('GET', '/platform/analytics/growth', { token: staff.token });
  const gr = d(r);
  gr?.churn && typeof gr.churn.churnRatePercent === 'number' && gr.tenantDbGrowthByMonth
    ? ok(`growth analytics (DBs total ${gr.tenantDbsTotal} · churn ${gr.churn.churnRatePercent}% last 30d)`)
    : bad('growth analytics', JSON.stringify(gr)?.slice(0, 140));

  r = await req('GET', '/platform/analytics', { token: staff.token });
  d(r)?.subscriptionConversion?.percent !== undefined
    ? ok(`subscription conversion surfaced (${d(r).subscriptionConversion.percent}%)`)
    : bad('conversion', m(r));

  console.log('\n═══ D. Renter payment behavior report ═══');
  r = await req('GET', '/tenant/reports/payment-behavior', H);
  Array.isArray(d(r)) && d(r).length >= 1 && d(r)[0].avgDaysToPay !== undefined
    ? ok(`payment behavior report live (${d(r).length} renter rows · top: ${d(r)[0].renter})`)
    : bad('payment behavior', m(r));

  console.log(`\n═══ RESULT: ${pass} passed / ${fail} failed ═══`);
  if (fail > 0) process.exit(1);
}
function sleep(ms: number) { return new Promise((r4) => setTimeout(r4, ms)); }

main().catch((e) => { console.error('❌ FATAL:', e.message ?? e); process.exit(1); });
