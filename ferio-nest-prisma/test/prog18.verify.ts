/** prog-18 verification: marketplace inquiry → org CRM lead auto-attribution. */
const B = process.env.API_BASE ?? 'http://localhost:6799/api/v1';
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
const sleep = (ms: number) => new Promise((r2) => setTimeout(r2, ms));

async function main() {
  const owner = d(await req('POST', '/identity/login', { body: { email: 'owner@demo.test', password: 'supersecret1' } }));
  const H = { token: owner.token, slug: 'sheakh-fam' };

  // Fresh unit published to marketplace
  const props = d(await req('GET', '/tenant/properties', H));
  const U = d(await req('POST', '/tenant/units', {
    ...H, body: { propertyId: props[0].id, name: `A-${Date.now() % 1000}`, type: 'APARTMENT', floor: 5, bedrooms: 3, bathrooms: 2, areaSqFt: 1300 },
  }));
  const ownerMe = d(await req('GET', '/identity/me', { token: owner.token }));
  let seller = d(await req('GET', `/marketplace/accounts/me/${ownerMe.userId}`, { token: owner.token }));
  if (!seller?.id) {
    seller = d(await req('POST', '/marketplace/accounts', {
      token: owner.token,
      body: { centralUserId: ownerMe.userId, displayName: 'Sheakh Family Properties' },
    }));
  }
  r = await req('POST', `/tenant/units/${U.id}/publish`, {
    ...H, body: { sellerAccountId: seller.id, price: 47000, purpose: 'RENT', assetType: 'APARTMENT' },
  });
  d(r)?.queued ? ok('unit published via outbox') : bad('publish', r);
  await sleep(7000); // worker drain

  const listing = d(await req('GET', '/tenant/units', H)).find((u: any) => u.id === U.id)?.marketplaceListingId;
  listing ? ok(`projected listing ${listing.slice(-6)}`) : bad('no projection');

  // Prospect identity inquires twice with same phone → single lead
  const inq = d(await req('POST', '/identity/register', { body: { email: `inq${Date.now()}@demo.test`, password: 'supersecret1', displayName: 'Imran Inquirer' } }));
  const acct = d(await req('POST', '/marketplace/accounts', { token: inq.token, body: { centralUserId: inq.user.userId, displayName: 'Imran Inquirer', phone: '01715550000', accountType: 'INDIVIDUAL' } }));

  await req('POST', `/marketplace/listings/${listing}/inquiries`, {
    token: inq.token,
    body: { senderAccountId: acct.id, senderName: 'Imran Inquirer', senderPhone: '01715550000', message: 'Is this still available?' },
  });
  await req('POST', `/marketplace/listings/${listing}/inquiries`, {
    token: inq.token,
    body: { senderAccountId: acct.id, senderName: 'Imran Inquirer', senderPhone: '01715550000', message: 'Following up!' },
  });
  ok('two inquiries sent');

  // async attribution — poll up to 12s
  let leads: any[] = [];
  for (let i = 0; i < 12; i++) {
    await sleep(1000);
    leads = d(await req('GET', '/tenant/crm/leads?status=NEW', H)).filter(
      (l: any) => l.source === 'MARKETPLACE_INQUIRY' && l.interestedUnitId === U.id,
    );
    if (leads.length) break;
  }
  leads.length === 1
    ? ok(`auto-attributed as CRM lead (${leads[0].name} · ${leads[0].phone}, deduped)`)
    : bad('attribution after polling', JSON.stringify(leads)?.slice(0, 200));

  console.log(`\n═══ RESULT: ${pass} passed / ${fail} failed ═══`);
  if (fail > 0) process.exit(1);
}
let r: any;

main().catch((e) => { console.error('❌ FATAL:', e.message ?? e); process.exit(1); });
