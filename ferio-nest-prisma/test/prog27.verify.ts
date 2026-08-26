/**
 * prog-27 verification — §23 completion (spotlight + revenue report),
 * anti-spam rate limits, self-serve subscribe→provision.
 */
const B = process.env.API_BASE ?? 'http://localhost:6799/api/v1';
let pass = 0, fail = 0;
const ok = (l: string) => { pass++; console.log(`  ✅ ${l}`); };
const bad = (l: string, d?: unknown) => { fail++; console.log(`  ❌ ${l}${d !== undefined ? ' → ' + String(d).slice(0, 160) : ''}`); };

async function req(method: string, path: string, o: { token?: string; body?: unknown } = {}) {
  const res = await fetch(`${B}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(o.token ? { Authorization: `Bearer ${o.token}` } : {}),
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
  return { token, userId: me?.userId };
}

async function main() {
  console.log('═══ A. Homepage spotlight (TOP_SEARCH eligibility) ═══');

  const seller = await register(`spot${TAG}@demo.test`, 'Spotlight Seller');
  await req('POST', '/marketplace/accounts', {
    token: seller.token, body: { centralUserId: seller.userId, displayName: 'Spotlight Seller' },
  }).then(d);
  r = d(await req('GET', `/marketplace/accounts/me/${seller.userId}`, { token: seller.token }));
  const sAcct = r;

  r = await req('POST', `/marketplace/accounts/${sAcct.id}/listings`, {
    token: seller.token,
    body: {
      purpose: 'RENT', assetType: 'APARTMENT',
      title: `Spotlight Penthouse ${TAG}`, price: 95000,
      area: 'Gulshan-2', district: 'Dhaka',
      latitude: 23.7925, longitude: 90.4078,
    },
  });
  const spotListing = d(r)?.id;
  const staff = d(await req('POST', '/identity/platform/login', {
    body: { email: 'admin@ferio.test', password: 'RootAdmin1!' },
  }));
  await req('POST', `/platform/marketplace/listings/${spotListing}/approve`, { token: staff.token });

  // Before promotion: not in spotlight
  let sp = d(await req('GET', '/marketplace/listings/spotlight'));
  !(sp?.items ?? []).some((x: any) => x.id === spotListing)
    ? ok('listing absent from spotlight before promotion')
    : bad('pre-promo spotlight', 'unexpectedly present');

  r = await req('POST', `/marketplace/listings/${spotListing}/promotions`, {
    token: seller.token, body: { type: 'TOP_SEARCH', durationDays: 7 },
  });
  const tsPromo = d(r);
  r = await req('POST', `/platform/marketplace/promotions/${tsPromo.id}/confirm-payment`, {
    token: staff.token, body: { paidVia: 'BANK', paymentReference: 'SPOT26' },
  });
  d(r)?.status === 'ACTIVE' ? ok('TOP_SEARCH paid & activated') : bad('confirm TOP_SEARCH', m(r));

  sp = d(await req('GET', '/marketplace/listings/spotlight'));
  const inSpot = (sp?.items ?? []).find((x: any) => x.id === spotListing);
  inSpot?.promotedUntil ? ok('listing appears in spotlight w/ promotedUntil') : bad('spotlight', JSON.stringify(sp)?.slice(0, 140));

  console.log('\n═══ B. Promotion revenue report (platform analytics) ═══');
  r = await req('GET', '/platform/analytics', { token: staff.token });
  const promos = d(r)?.promotions;
  promos?.revenueBdt >= 4000 && promos?.byType?.TOP_SEARCH?.count >= 1 && Object.keys(promos?.byMonth ?? {}).length >= 1
    ? ok(`revenue report live (৳${promos.revenueBdt} · TOP_SEARCH ×${promos.byType.TOP_SEARCH.count} · months: ${Object.keys(promos.byMonth).join(',')})`)
    : bad('revenue report', JSON.stringify(promos)?.slice(0, 160));

  console.log('\n═══ C. Anti-spam rate limits ═══');
  // Default inquiry throttle is 30/hour; the 31st request must be rejected.
  const spammer = await register(`spam${TAG}@demo.test`, 'Eager Spammer');
  const spamAcct = d(await req('POST', '/marketplace/accounts', {
    token: spammer.token, body: { centralUserId: spammer.userId, displayName: 'Eager' },
  }));
  let got429 = false;
  let successes = 0;
  for (let i = 0; i < 35; i++) {
    r = await req('POST', `/marketplace/listings/${spotListing}/inquiries`, {
      token: spammer.token,
      body: { senderAccountId: spamAcct.id, message: `Spam attempt ${i}` },
    });
    if (r.status === 429) { got429 = true; break; }
    if (r.status === 201 || r.status === 200) successes++;
  }
  got429 ? ok(`contact rate limit bites (${successes} allowed then 429)`) : bad('rate limit', `no 429 after ${successes + 1} inquiries`);

  console.log('\n═══ D. Self-serve subscribe → provision ═══');
  const founder = await register(`founder${TAG}@demo.test`, `Fahim Founder ${TAG}`);

  // Unauthenticated blocked
  r = await req('POST', '/identity/my/organizations', { body: { name: 'Nope Org' } });
  r.status === 401 || r.status === 403 ? ok('anonymous cannot self-provision') : bad('authz', r.status);

  r = await req('POST', '/identity/my/organizations', {
    token: founder.token,
    body: { name: `Founder Properties ${TAG}`, planTier: 'STARTER' },
  });
  const org = d(r);
  org?.status === 'COMPLETED' && org.domain && org.schemaVersion
    ? ok(`org provisioned → ${org.slug}.ferio.com · schema ${org.schemaVersion}`)
    : bad('self-serve provision', m(r));

  r = await req('POST', '/identity/my/organizations', {
    token: founder.token,
    body: { name: 'Slug Clash Co', slug: org.slug },
  });
  ['COMPLETED', 'ALREADY_PROVISIONED'].includes(d(r)?.status)
    ? ok('owner re-request of same slug is idempotent (no side effects)')
    : bad('own slug re-entry', `${r.status} ${m(r)}`);

  // A DIFFERENT user requesting the same slug must 409 (no info leak)
  const rival = await register(`rival${TAG}@demo.test`, 'Rival Renter');
  r = await req('POST', '/identity/my/organizations', {
    token: rival.token,
    body: { name: 'Rival Org', slug: org.slug },
  });
  r.status === 409 ? ok('another user requesting taken slug → 409 (no leak)') : bad('rival slug', `${r.status} ${m(r)}`);

  r = await req('GET', '/identity/my/organizations', { token: founder.token });
  const mine = d(r) ?? [];
  const joined = mine.find((x: any) => x.slug === org.slug);
  joined?.memberRole === 'ORGANIZATION_OWNER'
    ? ok('founder is ORGANIZATION_OWNER of the new workspace')
    : bad('membership', JSON.stringify(mine)?.slice(0, 140));

  console.log(`\n═══ RESULT: ${pass} passed / ${fail} failed ═══`);
  if (fail > 0) process.exit(1);
}

main().catch((e) => { console.error('❌ FATAL:', e.message ?? e); process.exit(1); });
