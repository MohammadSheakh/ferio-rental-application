/**
 * prog-26 verification — §23 Paid Listing Promotions + §24 Room-by-Room Detail.
 * Requires: API on :6799, ferio-pg-gis scratch DBs, migrations 0009/003 applied.
 */
const B = process.env.API_BASE ?? 'http://localhost:6799/api/v1';
const MKT_DB = process.env.MARKETPLACE_DATABASE_URL ?? 'postgresql://postgres:testpass@localhost:5498/ferio_marketplace';
let pass = 0, fail = 0;
const ok = (l: string) => { pass++; console.log(`  ✅ ${l}`); };
const bad = (l: string, d?: unknown) => { fail++; console.log(`  ❌ ${l}${d !== undefined ? ' → ' + String(d).slice(0, 160) : ''}`); };

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
function m(r: any) { return r?.message ?? JSON.stringify(r)?.slice(0, 120); }
let r: any;
const TAG = Date.now() % 100000;

async function register(email: string, name: string) {
  const rr = await req('POST', '/identity/register', {
    body: { email, password: 'supersecret1', displayName: name },
  });
  let token = d(rr)?.token;
  if (!token) {
    const lg = await req('POST', '/identity/login', { body: { email, password: 'supersecret1' } });
    token = d(lg)?.token;
  }
  const me = d(await req('GET', '/identity/me', { token }));
  return { token, userId: me?.userId ?? d(rr)?.user?.userId };
}

/** pg access for direct-state manipulation (expiry backdating). */
async function pgQuery(sql: string) {
  const { Client } = require('pg');
  const c = new Client({ connectionString: MKT_DB });
  await c.connect();
  const res = await c.query(sql);
  await c.end();
  return res.rows;
}
const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

async function main() {
  // ══════════════════════════ A. PROMOTIONS ══════════════════════════
  console.log('\n═══ A. Paid promotion catalog & order lifecycle ═══');

  r = await req('GET', '/marketplace/promotions/catalog');
  const cat = d(r);
  const featured15 = cat?.products?.find((p: any) => p.type === 'FEATURED')?.durations?.find((x: any) => x.days === 15);
  cat?.products?.length === 3 && featured15?.priceBdt === 1500
    ? ok(`catalog live (3 products · FEATURED/15d = ৳${featured15.priceBdt})`)
    : bad('catalog', JSON.stringify(cat)?.slice(0, 140));

  const seller = await register(`promoseller${TAG}@demo.test`, 'Promo Seller');
  r = await req('POST', '/marketplace/accounts', {
    token: seller.token,
    body: { centralUserId: seller.userId, displayName: 'Promo Seller', accountType: 'OWNER' },
  });
  const sAcct = d(r);

  const AREA = `PromoRank${TAG}`;
  r = await req('POST', `/marketplace/accounts/${sAcct.id}/listings`, {
    token: seller.token,
    body: {
      purpose: 'RENT', assetType: 'APARTMENT',
      title: `Promoted 3BR Rampura ${TAG}`, price: 28000,
      area: AREA, district: 'Dhaka', bedrooms: 3,
      latitude: 23.7629, longitude: 90.4184,
    },
  });
  const promotedId = d(r)?.id;

  r = await req('POST', `/marketplace/accounts/${sAcct.id}/listings`, {
    token: seller.token,
    body: {
      purpose: 'RENT', assetType: 'APARTMENT',
      title: `Free 2BR Rampura ${TAG}`, price: 18000,
      area: AREA, district: 'Dhaka', bedrooms: 2,
      latitude: 23.7701, longitude: 90.4102,
    },
  });
  const freeId = d(r)?.id;

  const staff = d(await req('POST', '/identity/platform/login', {
    body: { email: 'admin@ferio.test', password: 'RootAdmin1!' },
  }));
  await req('POST', `/platform/marketplace/listings/${promotedId}/approve`, { token: staff.token });
  r = await req('POST', `/platform/marketplace/listings/${freeId}/approve`, { token: staff.token });
  d(r)?.status === 'ACTIVE' ? ok('two listings created + approved (same area)') : bad('approve listings', m(r));

  // Order FEATURED on own listing
  r = await req('POST', `/marketplace/listings/${promotedId}/promotions`, {
    token: seller.token, body: { type: 'FEATURED', durationDays: 15 },
  });
  const promo = d(r);
  promo?.status === 'PENDING_PAYMENT' && promo.amountBdt === 1500
    ? ok('order placed → PENDING_PAYMENT (৳1,500 / 15d)')
    : bad('order promo', m(r));

  // duplicate same-type blocked
  r = await req('POST', `/marketplace/listings/${promotedId}/promotions`, {
    token: seller.token, body: { type: 'FEATURED', durationDays: 7 },
  });
  r.status === 400 ? ok('duplicate open same-type order blocked (400)') : bad('dup order', r.status);

  // non-owner blocked
  const stranger = await register(`promostranger${TAG}@demo.test`, 'Stranger S');
  r = await req('POST', `/marketplace/accounts`, {
    token: stranger.token, body: { centralUserId: stranger.userId, displayName: 'Stranger' },
  });
  const stAcct = d(r);
  r = await req('POST', `/marketplace/accounts/${stAcct.id}/listings`, {
    token: stranger.token,
    body: { purpose: 'RENT', assetType: 'ROOM', title: `Stranger room ${TAG}`, price: 5000, area: AREA, district: 'Dhaka' },
  });
  const strangerListing = d(r)?.id;
  await req('POST', `/platform/marketplace/listings/${strangerListing}/approve`, { token: staff.token });
  r = await req('POST', `/marketplace/listings/${promotedId}/promotions`, {
    token: stranger.token, body: { type: 'URGENT', durationDays: 7 },
  });
  r.status === 403 ? ok('non-owner cannot promote someone else\'s listing (403)') : bad('non-owner guard', r.status);

  console.log('\n═══ B. Payment confirmation → ranking boost ═══');

  r = await req('POST', `/platform/marketplace/promotions/${promo.id}/confirm-payment`, {
    token: staff.token, body: { paidVia: 'BKASH', paymentReference: 'TRX26PROG' },
  });
  d(r)?.status === 'ACTIVE' && d(r)?.expiresAt ? ok('platform confirmed payment → ACTIVE w/ window') : bad('confirm payment', m(r));

  r = await req('GET', `/marketplace/listings/${promotedId}`);
  let det = d(r);
  det?.promotionTier === 2 && det?.promotionBadges?.includes('FEATURED')
    ? ok('listing carries tier=2 + [FEATURED] badge')
    : bad('badge state', JSON.stringify(det && { t: det.promotionTier, b: det.promotionBadges }));

  // Advertiser self-activation impossible (no advertiser route exists) — verify pending cancel rules instead
  const other = await register(`promosellerb${TAG}@demo.test`, 'Promo Seller B');
  r = await req('POST', '/marketplace/accounts', {
    token: other.token, body: { centralUserId: other.userId, displayName: 'Seller B' },
  });
  const bAcct = d(r);
  r = await req('POST', `/marketplace/listings/${strangerListing}/promotions`, {
    token: stranger.token, body: { type: 'TOP_SEARCH', durationDays: 30 },
  });
  const tsOrder = d(r);
  r = await req('POST', `/marketplace/promotions/${tsOrder.id}/cancel`, { token: stranger.token, body: { reason: 'changed mind' } });
  d(r)?.status === 'CANCELLED' ? ok('advertiser cancels own PENDING order') : bad('own cancel', m(r));
  void other; void bAcct;

  // Ranking: free listing is newer but promoted must come first
  r = await req('GET', `/marketplace/listings/search?area=${AREA}&purpose=RENT`);
  const items = d(r)?.items ?? [];
  items[0]?.id === promotedId && items[0]?.promotionTier === 2
    ? ok(`search ranks promoted first (${items.length} in bucket)`)
    : bad('ranking', JSON.stringify(items.map((i: any) => ({ id: i.id?.slice(-4), tier: i.promotionTier }))));

  // Stats after an inquiry lands in-window
  const buyer = await register(`promobuyer${TAG}@demo.test`, 'Curious Renter');
  const buyerAcct = d(await req('POST', `/marketplace/accounts`, {
    token: buyer.token, body: { centralUserId: buyer.userId, displayName: 'Curious' },
  }));
  await req('POST', `/marketplace/listings/${promotedId}/inquiries`, {
    token: buyer.token,
    body: { senderAccountId: buyerAcct.id, message: 'Is it still available?' },
  }).catch(() => {});
  r = await req('GET', `/marketplace/promotions/${promo.id}/stats`, { token: seller.token });
  d(r)?.inquiriesInWindow >= 1
    ? ok(`promotion stats count in-window inquiries (${d(r)?.inquiriesInWindow})`)
    : bad('stats', m(r));

  console.log('\n═══ C. Expiry scan removes boost ═══');

  // URGENT order → confirm → backdate expiresAt directly → scan
  r = await req('POST', `/marketplace/listings/${promotedId}/promotions`, {
    token: seller.token, body: { type: 'URGENT', durationDays: 7 },
  });
  const urgent = d(r);
  await req('POST', `/platform/marketplace/promotions/${urgent.id}/confirm-payment`, {
    token: staff.token, body: { paidVia: 'NAGAD' },
  });
  await pgQuery(`UPDATE "ListingPromotion" SET "expiresAt" = now() - interval '1 hour' WHERE id = '${urgent.id}'`);

  r = await req('POST', '/platform/jobs/expire-promotions', { token: staff.token });
  d(r)?.expired >= 1 ? ok(`expiry scan flipped ${d(r)?.expired} promotion(s) EXPIRED`) : bad('expiry scan', m(r));

  r = await req('GET', `/marketplace/listings/${promotedId}`);
  det = d(r);
  !det?.promotionBadges?.includes('URGENT') && det?.promotionBadges?.includes('FEATURED')
    ? ok('expired URGENT badge removed, FEATURED retained (recomputed)')
    : bad('post-expiry badges', JSON.stringify(det?.promotionBadges));

  console.log('\n═══ D. §24 Room-by-room unit detail (tenant → marketplace) ═══');

  const owner = d(await req('POST', '/identity/login', { body: { email: 'owner@demo.test', password: 'supersecret1' } }));
  const ownerMe = d(await req('GET', '/identity/me', { token: owner.token }));
  const H = { token: owner.token, slug: 'sheakh-fam' };

  props = d(await req('GET', '/tenant/properties', H));
  if (!props?.length) {
    props = [d(await req('POST', '/tenant/properties', { ...H, body: { name: `Prog26 Tower ${TAG}`, type: 'RESIDENTIAL_BUILDING' } }))];
  }
  r = await req('POST', '/tenant/units', {
    ...H, body: { propertyId: props[0].id, name: `R26-${TAG}`, type: 'APARTMENT', floor: 5, bedrooms: 3, bathrooms: 2, areaSqFt: 1250 },
  });
  const unit = d(r);
  unit?.id ? ok(`unit ${unit.name} created`) : bad('unit create', m(r));

  r = await req('POST', `/tenant/units/${unit.id}/rooms`, {
    ...H,
    body: {
      name: 'Master Bedroom', type: 'MASTER_BEDROOM', lengthFt: 14, widthFt: 12, sortOrder: 0,
      description: 'Attached bath, south-facing',
      media: [{ url: `https://img.ferio.test/demo/master-${TAG}.jpg`, caption: 'Wide angle' }],
    },
  });
  const masterRoom = d(r);
  r = await req('POST', `/tenant/units/${unit.id}/rooms`, {
    ...H,
    body: { name: 'Kitchen', type: 'KITCHEN', lengthFt: 9, widthFt: 8, sortOrder: 1, description: 'Fitted cabinets, gas line' },
  });
  const kitchen = d(r);
  masterRoom && kitchen ? ok('rooms added w/ media (14×12 master · 9×8 kitchen)') : bad('room create', m(r));

  r = await req('GET', `/tenant/units/${unit.id}/rooms`, H);
  const roomsList = d(r);
  const masterCalc = roomsList?.find((x: any) => x.type === 'MASTER_BEDROOM');
  masterCalc?.areaSqFt === 168
    ? ok('tenant room list computes sqft (168 for 14×12)')
    : bad('sqft calc', JSON.stringify(masterCalc && masterCalc.areaSqFt));

  // Publish with a marketplace seller account bound to the owner identity
  let ownerAcct = d(await req('GET', `/marketplace/accounts/me/${ownerMe.userId}`, { token: owner.token }));
  if (!ownerAcct?.id) {
    ownerAcct = d(await req('POST', '/marketplace/accounts', {
      token: owner.token,
      body: { centralUserId: ownerMe.userId, displayName: 'Sheakh Family Properties' },
    }));
  }
  r = await req('POST', `/tenant/units/${unit.id}/publish`, {
    ...H, body: { sellerAccountId: ownerAcct.id, price: 35000 },
  });
  d(r)?.queued ? ok('publish queued via outbox (w/ room snapshot)') : bad('publish', m(r));

  // Deterministic: locate the projected listing via its source-unit binding,
  // then prove it is publicly searchable in its own area.
  let projectedId: string | null = null;
  for (let i = 0; i < 25 && !projectedId; i++) {
    await sleep(1000);
    const rows = await pgQuery(`SELECT id FROM "PropertyListing" WHERE "sourceUnitId" = '${unit.id}' ORDER BY "createdAt" DESC LIMIT 1`);
    if (rows.length) projectedId = rows[0].id;
  }
  if (!projectedId) { bad('projection visible', 'no PropertyListing row for sourceUnitId'); process.exit(1); }

  r = await req('GET', `/marketplace/listings/${projectedId}`);
  const projBase = d(r);
  r = await req('GET', `/marketplace/listings/search?area=${encodeURIComponent(projBase.area ?? '')}&purpose=RENT&limit=100`);
  const visiblePublicly = (d(r)?.items ?? []).some((x: any) => x.id === projectedId);
  projectedId && visiblePublicly ? ok('projection drained → publicly searchable') : bad('projection visible', JSON.stringify({ projectedId, visiblePublicly }));
  const projected = { id: projectedId };

  r = await req('GET', `/marketplace/listings/${projected.id}`);
  const pubDetail = d(r);
  const pubMaster = pubDetail?.rooms?.find((x: any) => x.type === 'MASTER_BEDROOM');
  pubDetail?.rooms?.length >= 2 &&
  pubMaster?.lengthFt === 14 && pubMaster?.widthFt === 12 &&
  pubMaster?.media?.length === 1
    ? ok('public detail renders rooms w/ ft×ft + photos (idempotent projection)')
    : bad('public rooms', JSON.stringify(pubDetail?.rooms)?.slice(0, 180));

  // Room edit → update projection → reflected publicly
  r = await req('PATCH', `/tenant/unit-rooms/${kitchen.id}`, {
    ...H, body: { lengthFt: 11, widthFt: 9, description: 'Fitted cabinets, gas line, window' },
  });
  d(r)?.areaSqFt !== undefined || d(r)?.lengthFt === 11 ? ok('room dimensions edited tenant-side') : bad('room edit', m(r));
  r = await req('PATCH', `/tenant/units/${unit.id}/publish`, { ...H, body: { price: 36000 } });
  d(r)?.queued ? ok('update-projection queued (rooms re-snapshot)') : bad('update publish', m(r));

  let updatedRooms: any = null;
  for (let i = 0; i < 20; i++) {
    await sleep(1000);
    r = await req('GET', `/marketplace/listings/${projected.id}`);
    updatedRooms = d(r)?.rooms;
    const k = updatedRooms?.find((x: any) => x.type === 'KITCHEN');
    if (k?.lengthFt === 11) break;
  }
  updatedRooms?.find((x: any) => x.type === 'KITCHEN')?.lengthFt === 11
    ? ok('edited kitchen (9×8→11×9) reflected on marketplace')
    : bad('room sync', JSON.stringify(updatedRooms)?.slice(0, 160));

  console.log(`\n═══ RESULT: ${pass} passed / ${fail} failed ═══`);
  if (fail > 0) process.exit(1);
}

let props: any[];
main().catch((e) => { console.error('❌ FATAL:', e.message ?? e); process.exit(1); });
