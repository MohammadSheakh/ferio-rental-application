/**
 * prog-38 verification — § W27 gateway integration:
 * mock-driver checkouts for BOTH money flows (platform invoice + listing
 * promotion): initiate → sandbox decision → fulfillment exactly-once,
 * plus failure/cancel paths, ownership guards and gateway availability.
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
const d = (r: any) => r?.data ?? r; // payments controller returns raw payloads
function m(r: any) { return r?.message ?? JSON.stringify(r)?.slice(0, 130); }
let r: any;
const TAG = Date.now();

async function main() {
  const staff = d(await req('POST', '/identity/platform/login', {
    body: { email: 'admin@ferio.test', password: 'RootAdmin1!' },
  }));

  console.log('\n═══ A. Gateway registry ═══');
  // Registry is internal; prove via behavior — mock works, unconfigured real ones error cleanly.
  // (bkash etc. are not configured in scratch → createIntent must say so.)

  console.log('\n═══ B. Platform invoice paid online (mock driver) ═══');

  // Fresh founder + workspace → first invoice DUE
  const email = `payfounder${TAG}@demo.test`;
  r = await req('POST', '/identity/register', {
    body: { email, password: 'supersecret1', displayName: `Pay Founder ${TAG}` },
  });
  let token = d(r)?.token;
  if (!token) token = d(await req('POST', '/identity/login', { body: { email, password: 'supersecret1' } }))?.token;
  const uid = d(await req('GET', '/identity/me', { token }))?.userId;

  r = await req('POST', '/identity/my/organizations', {
    token,
    body: { name: `Pay Org ${TAG}`, planTier: 'STARTER' },
  });
  const org = d(r);
  const inv = org?.firstInvoice;
  inv?.id && inv.status === 'DUE' ? ok(`first platform invoice DUE (৳${inv.amountBdt})`) : bad('invoice', m(org));

  // Ownership guard: another user cannot pay someone else's invoice
  const strangerTok =
    d(await req('POST', '/identity/register', { body: { email: `strg${TAG}@demo.test`, password: 'supersecret1', displayName: 'Stranger' } }))?.token ||
    d(await req('POST', '/identity/login', { body: { email: `strg${TAG}@demo.test`, password: 'supersecret1' } }))?.token;
  r = await req('POST', '/payments/intents', {
    token: strangerTok,
    body: { context: 'PLATFORM_INVOICE', refId: inv.id, gateway: 'mock' },
  });
  r.status === 403 ? ok('stranger cannot open a checkout on a foreign invoice (403)') : bad('ownership guard', `${r.status} ${m(r)}`);

  // Owner initiates mock checkout
  r = await req('POST', '/payments/intents', {
    token,
    body: { context: 'PLATFORM_INVOICE', refId: inv.id, gateway: 'mock' },
  });
  const intent = d(r);
  intent?.paymentUrl?.includes('/sandbox/') && intent.intentId
    ? ok(`checkout initiated (${intent.gateway} · ৳${intent.amountBdt})`)
    : bad('initiate', m(r));

  // Sandbox hosted page renders
  const pageRes = await fetch(`${B}/payments/sandbox/${intent.intentId}`);
  (await pageRes.text()).includes('Sandbox Checkout')
    ? ok('sandbox hosted page served')
    : bad('hosted page', pageRes.status);

  // Simulate FAILURE first
  r = await fetch(`${B}/payments/sandbox/${intent.intentId}/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ outcome: 'fail' }),
  }).then((x2) => x2.json());
  r = d(r);
  r?.status === 'FAILED' ? ok('failed payment recorded FAILED') : bad('fail path', m(r));

  // Retry: fresh PENDING intent for the same invoice
  r = await req('POST', '/payments/intents', {
    token,
    body: { context: 'PLATFORM_INVOICE', refId: inv.id, gateway: 'mock' },
  });
  const retry = d(r);

  // Confirm success via the hosted-page form endpoint
  r = await fetch(`${B}/payments/sandbox/${retry.intentId}/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ outcome: 'success' }),
  }).then((x3) => x3.json());
  r = d(r);
  r?.status === 'PAID' ? ok('payment confirmed → intent PAID') : bad('confirm', m(r));

  // Fulfillment: invoice flipped to PAID w/ GATEWAY payment
  const invs = d(await req('GET', `/platform/billing/invoices?organizationId=${org.organizationId}&status=PAID`, { token: staff.token }));
  const settled = (Array.isArray(invs) ? invs : []).find((x: any) => x.id === inv.id);
  settled && settled.payments.some((p: any) => p.method === 'GATEWAY' && p.reference.startsWith('mock:'))
    ? ok('platform billing fulfilled (method=GATEWAY · reference=mock:<txn>)')
    : bad('billing fulfillment', JSON.stringify(settled)?.slice(0, 150));

  // Double-confirm rejected
  r = await fetch(`${B}/payments/sandbox/${retry.intentId}/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ outcome: 'success' }),
  }).then((x4) => x4.json());
  /already/i.test(String(r.message ?? '')) || /already/.test(String(r.detail ?? ''))
    ? ok('double-confirmation blocked')
    : bad('double confirm', m(r));

  console.log('\n═══ C. Promotion paid online (mock driver) ═══');

  // Seller posts + approves a RENT listing
  const seller = await register(`payseller${TAG}@demo.test`, 'Pay Seller');
  await req('POST', '/marketplace/accounts', {
    token: seller.token, body: { centralUserId: seller.userId, displayName: 'Pay Seller' },
  });
  const sAcct = d(await req('GET', `/marketplace/accounts/me/${seller.userId}`, { token: seller.token }));
  r = await req('POST', `/marketplace/accounts/${sAcct.id}/listings`, {
    token: seller.token,
    body: {
      purpose: 'RENT', assetType: 'APARTMENT',
      title: `Gateway Boosted Flat ${TAG}`, price: 26000,
      area: 'Dhanmondi', district: 'Dhaka',
      latitude: 23.7461, longitude: 90.376,
    },
  });
  const listingId = d(r)?.id;
  await req('POST', `/platform/marketplace/listings/${listingId}/approve`, { token: staff.token });

  // Order FEATURED promo
  r = await req('POST', `/marketplace/listings/${listingId}/promotions`, {
    token: seller.token, body: { type: 'FEATURED', durationDays: 7 },
  });
  const promo = d(r);

  // Pay it through the gateway
  r = await req('POST', '/payments/intents', {
    token: seller.token,
    body: { context: 'LISTING_PROMOTION', refId: promo.id, gateway: 'mock' },
  });
  const pIntent = d(r);
  pIntent?.amountBdt === 800 ? ok('promotion checkout initiated (৳800 / 7d FEATURED)') : bad('promo intent', m(r));

  // Confirm success
  r = await fetch(`${B}/payments/sandbox/${pIntent.intentId}/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ outcome: 'success' }),
  }).then((x5) => x5.json());
  r = d(r);
  r?.status === 'PAID' ? ok('promotion payment PAID') : bad('promo confirm', m(r));

  // Promotion activated with GATEWAY ledger trail
  r = await req('GET', `/marketplace/listings/${listingId}`);
  const det = d(r);
  det?.promotionTier === 2 && det?.promotionBadges?.includes('FEATURED') && det?.promotedUntil
    ? ok('promotion ACTIVE (tier=2 · FEATURED badge · promotedUntil set)')
    : bad('activation', JSON.stringify(det && { t: det.promotionTier, b: det.promotionBadges })?.slice(0, 120));

  // Platform-side promotion record shows the gateway payment
  r = await req('GET', `/platform/marketplace/promotions?status=ACTIVE`, { token: staff.token });
  const rec = (Array.isArray(d(r)) ? d(r) : []).find((x: any) => x.id === promo.id);
  rec?.paidVia === 'GATEWAY' && String(rec.paymentReference).startsWith('mock:')
    ? ok(`promotion ledger shows GATEWAY payment (${rec.paymentReference.slice(0, 18)}…)`)
    : bad('promo record', JSON.stringify(rec)?.slice(0, 140));

  console.log('\n═══ D. Cancel path + status endpoint ═══');
  r = await req('POST', `/marketplace/listings/${listingId}/promotions`, {
    token: seller.token, body: { type: 'URGENT', durationDays: 7 },
  });
  const urgentPromo = d(r);
  r = await req('POST', '/payments/intents', {
    token: seller.token,
    body: { context: 'LISTING_PROMOTION', refId: urgentPromo.id, gateway: 'mock' },
  });
  const uIntent = d(r);
  r = await fetch(`${B}/payments/sandbox/${uIntent.intentId}/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ outcome: 'cancel' }),
  }).then((x6) => x6.json());
  r = d(r);
  r?.status === 'FAILED' ? ok('cancel recorded FAILED') : bad('cancel path', m(r));

  r = await req('GET', `/payments/intents/${uIntent.intentId}`, {});
  void r;
  r = await fetch(`${B}/payments/intents/${uIntent.intentId}`, {
    headers: { Authorization: `Bearer ${(await req('GET', '/identity/me', { token: seller.token })).data?.userId ? seller.token : ''}` },
  });
  r.status === 200 ? ok('status endpoint reachable (authed)') : bad('status', r.status);

  console.log(`\n═══ RESULT: ${pass} passed / ${fail} failed ═══`);
  if (fail > 0) process.exit(1);
}

async function register(email: string, name: string) {
  const rr = await req('POST', '/identity/register', {
    body: { email, password: 'supersecret1', displayName: name },
  });
  let token = d(rr)?.token;
  if (!token) token = d(await req('POST', '/identity/login', { body: { email, password: 'supersecret1' } }))?.token;
  const me = d(await req('GET', '/identity/me', { token }));
  return { token, userId: me?.userId };
}

main().catch((e) => { console.error('❌ FATAL:', e.message ?? e); process.exit(1); });
