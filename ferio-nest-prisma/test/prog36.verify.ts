/**
 * prog-36 verification — § Week 22 recurring statement generation +
 * scheduler registration, § Week 30 listing attribution in CRM,
 * cross-tenant isolation (§18 Scenario E / Week 24 hardening).
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
const TAG = Date.now();

async function pgQuery(sql: string) {
  const { Client } = require('pg');
  const c = new Client({ connectionString: process.env.MARKETPLACE_DATABASE_URL ?? 'postgresql://postgres:testpass@localhost:5498/ferio_marketplace' });
  await c.connect();
  const rows = await c.query(sql);
  await c.end();
  return rows.rows;
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

async function main() {
  console.log('\n═══ A. Recurring monthly statements (§ W22 scheduler job) ═══');
  const staff = d(await req('POST', '/identity/platform/login', {
    body: { email: 'admin@ferio.test', password: 'RootAdmin1!' },
  }));

  r = await req('POST', '/jobs/generate-monthly-statements'.replace('/jobs', '/platform/jobs'), { token: staff.token });
  const first = d(r);
  first?.orgsScanned >= 1 ? ok(`statement scan ran across ${first.orgsScanned} orgs (${first.invoicesCreated} created)`) : bad('statements scan', m(r));

  // Idempotency: second run creates zero
  r = await req('POST', '/platform/jobs/generate-monthly-statements', { token: staff.token });
  d(r)?.invoicesCreated === 0
    ? ok('re-run creates zero invoices (periodKey idempotent)')
    : bad('idempotency', m(r));

  console.log('\n═══ B. Listing attribution in CRM (§ W30 tail) ═══');

  // SaaS side: publish a unit
  const owner = d(await req('POST', '/identity/login', { body: { email: 'owner@demo.test', password: 'supersecret1' } }));
  const H = { token: owner.token, slug: 'sheakh-fam' };
  const ownerUid = d(await req('GET', '/identity/me', { token: owner.token }))?.userId;
  const props = d(await req('GET', '/tenant/properties', H));
  const unit = d(await req('POST', '/tenant/units', {
    ...H, body: { propertyId: props[0].id, name: `ATTR-${TAG}`, type: 'APARTMENT', floor: 6, bedrooms: 3, bathrooms: 2 },
  }));
  if (!unit?.id) { bad('unit create', m(r)); process.exit(1); }

  let ownerAcct = d(await req('GET', `/marketplace/accounts/me/${ownerUid}`, { token: owner.token }));
  if (!ownerAcct?.id) {
    ownerAcct = d(await req('POST', '/marketplace/accounts', {
      token: owner.token,
      body: { centralUserId: ownerUid, displayName: 'Sheakh Family Properties' },
    }));
  }
  if (!ownerAcct?.id) { bad('seller account', 'missing'); process.exit(1); }
  r = await req('POST', `/tenant/units/${unit.id}/publish`, { ...H, body: { sellerAccountId: ownerAcct.id, price: 41000 } });
  d(r)?.queued ? ok('unit published') : bad('publish', m(r));

  // Prospect inquires twice on the projected ad
  const buyer = await register(`attrbuy${TAG}@demo.test`, 'Atif Buyer');
  const bAcct = d(await req('POST', '/marketplace/accounts', {
    token: buyer.token, body: { centralUserId: buyer.userId, displayName: 'Atif Buyer', phone: '01611000111' },
  }));

  let listingId: string | null = null;
  for (let i = 0; i < 30 && !listingId; i++) {
    await new Promise((res) => setTimeout(res, 1000));
    const rows = await pgQuery(
      `SELECT id FROM "PropertyListing" WHERE "sourceUnitId" = '${unit.id}' LIMIT 1`,
    );
    if (rows.length) listingId = rows[0].id;
  }
  if (!listingId) { bad('projection', 'not found'); process.exit(1); }
  ok(`projected ad live (${listingId.slice(-6)})`);

  for (const msg of ['Is this available?', 'Following up!']) {
    await req('POST', `/marketplace/listings/${listingId}/inquiries`, {
      token: buyer.token,
      body: { senderAccountId: bAcct.id, senderName: 'Atif Buyer', message: msg },
    });
  }

  // Lead must carry the LISTING id now
  let lead: any = null;
  for (let i = 0; i < 15 && !lead; i++) {
    await new Promise((res) => setTimeout(res, 1000));
    const leads = d(await req('GET', '/tenant/crm/leads', H)) ?? [];
    lead = leads.find((l: any) => l.interestedUnitId === unit.id);
  }
  lead?.listingId === listingId
    ? ok('CRM lead carries listing attribution (inquiry → listing → org)')
    : bad('listing attribution', JSON.stringify(lead && { id: lead.id, l: lead.listingId })?.slice(0, 150));

  console.log('\n═══ C. Cross-tenant isolation (§18 Scenario E) ═══');

  // Provision an independent org for the rival identity
  const rival = await register(`isolation${TAG}@demo.test`, `Iso Rival ${TAG}`);
  r = await req('POST', '/identity/my/organizations', {
    token: rival.token,
    body: { name: `Iso Org ${TAG}`, planTier: 'STARTER' },
  });
  const rivalSlug = d(r)?.slug;
  rivalSlug ? ok(`rival workspace provisioned (${rivalSlug})`) : bad('rival provision', m(r));

  // Rival's token + sheakh-fam slug: every read/write must be denied
  r = await req('GET', '/tenant/properties', { token: rival.token, slug: 'sheakh-fam' });
  r.status === 403 ? ok('rival cannot READ sheakh-fam properties (403)') : bad('read isolation', `${r.status} ${m(r)}`);

  r = await req('POST', '/tenant/properties', {
    token: rival.token, slug: 'sheakh-fam',
    body: { name: 'Injected Property', type: 'RESIDENTIAL_BUILDING' },
  });
  r.status === 403 ? ok('rival cannot WRITE into sheakh-fam (403)') : bad('write isolation', `${r.status} ${m(r)}`);

  // Rival sees only their own (empty) workspace
  r = await req('GET', '/tenant/properties', { token: rival.token, slug: rivalSlug });
  Array.isArray(d(r)) ? ok(`rival workspace isolated (${d(r).length} properties of their own)`) : bad('own workspace', m(r));

  // Owner token against rival slug also denied (membership is per-org)
  r = await req('GET', '/tenant/properties', { token: owner.token, slug: rivalSlug });
  r.status === 403 ? ok('owner of org A holds no implicit rights in org B (403)') : bad('cross check', `${r.status} ${m(r)}`);

  console.log(`\n═══ RESULT: ${pass} passed / ${fail} failed ═══`);
  if (fail > 0) process.exit(1);
}

main().catch((e) => { console.error('❌ FATAL:', e.message ?? e); process.exit(1); });
