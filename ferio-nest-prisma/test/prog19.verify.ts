/** prog-19 verification: Sale CRM — offer → counter → accept-counter → SOLD. */
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

async function register(email: string, name: string) {
  const r = await req('POST', '/identity/register', {
    body: { email, password: 'supersecret1', displayName: name },
  });
  return d(r)?.token;
}
async function makeAccount(token: string, userId: string, name: string, type = 'OWNER') {
  return d(await req('POST', '/marketplace/accounts', {
    token, body: { centralUserId: userId, displayName: name, accountType: type },
  }));
}

async function main() {
  // ── Seller posts a SALE listing ──
  const sTok = await register(`seller${Date.now()}@demo.test`, 'Saleh Seller');
  const sellerMe = d(await req('GET', '/identity/me', { token: sTok }));
  if (!sellerMe?.userId) { bad('seller register/login', JSON.stringify(sellerMe) + ' ||TOK:' + String(sTok).slice(0,20)); process.exit(1); }
  const sellerAcct = await makeAccount(sTok, sellerMe.userId, 'Saleh Seller');

  r = await req('POST', `/marketplace/accounts/${sellerAcct.id}/listings`, {
    token: sTok,
    body: {
      purpose: 'SALE', assetType: 'APARTMENT',
      title: '3BR 2,100sqft Bashundhara R/A — asking 3.8 Cr',
      price: 38_000_000, area: 'Bashundhara R/A', district: 'Dhaka',
      bedrooms: 3, bathrooms: 3, areaSqFt: 2100,
      latitude: 23.8103, longitude: 90.4293,
    },
  });
  const listingId = d(r)?.id;
  listingId ? ok(`SALE listing created (${listingId.slice(-6)})`) : bad('listing create', r);

  // Approve through moderation so it becomes ACTIVE
  const staff = d(await req('POST', '/identity/platform/login', {
    body: { email: 'admin@ferio.test', password: 'RootAdmin1!' },
  }));
  r = await req('POST', `/platform/marketplace/listings/${listingId}/approve`, { token: staff.token });
  d(r)?.status === 'ACTIVE' ? ok('moderation approved → ACTIVE') : bad('approve', m(r));

  // ── Buyer 1 offers 3.2 Cr ──
  const b1tok = await register(`buyer1${Date.now()}@demo.test`, 'Buyer One');
  const b1me = d(await req('GET', '/identity/me', { token: b1tok }));
  await makeAccount(b1tok, b1me.userId, 'Buyer One', 'INDIVIDUAL');

  r = await req('POST', `/marketplace/listings/${listingId}/offers`, {
    token: b1tok, body: { amount: 32_000_000, note: 'Cash ready' },
  });
  const o1 = d(r);
  o1?.status === 'PENDING' ? ok('buyer-1 offer PENDING (3.2 Cr)') : bad('offer1', m(r));

  // self-offer guard
  r = await req('POST', `/marketplace/listings/${listingId}/offers`, { token: sTok, body: { amount: 1_000_000 } });
  r.status === 403 ? ok('self-offer blocked (403)') : bad('self-offer', r.status);

  // ── Buyer 2 offers 3.4 Cr ──
  const b2tok = await register(`buyer2${Date.now()}@demo.test`, 'Buyer Two');
  const b2me = d(await req('GET', '/identity/me', { token: b2tok }));
  await makeAccount(b2tok, b2me.userId, 'Buyer Two', 'INDIVIDUAL');
  r = await req('POST', `/marketplace/listings/${listingId}/offers`, {
    token: b2tok, body: { amount: 34_000_000 },
  });
  const o2 = d(r);
  o2?.status === 'PENDING' ? ok('buyer-2 offer PENDING (3.4 Cr)') : bad('offer2', m(r));

  // duplicate pending blocked
  r = await req('POST', `/marketplace/listings/${listingId}/offers`, { token: b1tok, body: { amount: 33_000_000 } });
  r.status === 409 ? ok('duplicate pending offer blocked (409)') : bad('dup offer', r.status);

  console.log('═══ Negotiation ═══');
  r = await req('POST', `/marketplace/offers/${o1.id}/counter`, { token: sTok, body: { amount: 35_500_000 } });
  d(r)?.status === 'COUNTERED' && d(r)?.counterAmount === 35_500_000
    ? ok('seller countered at 3.55 Cr')
    : bad('counter', m(r));

  r = await req('POST', `/marketplace/offers/${o1.id}/accept-counter`, { token: b1tok });
  d(r)?.listingStatus === 'SOLD'
    ? ok('buyer accepted counter → listing SOLD')
    : bad('accept counter', m(r));

  const mine = d(await req('GET', '/marketplace/offers/mine', { token: b1tok }));
  const won = mine.find((x: any) => x.id === o1.id);
  won?.status === 'ACCEPTED' && won.decidedAt ? ok('offer ACCEPTED w/ decidedAt') : bad('mine state', JSON.stringify(won)?.slice(0, 80));

  // sibling auto-rejected
  r = await req('GET', `/marketplace/listings/${listingId}/offers`, { token: sTok });
  const sib = d(r).find((x: any) => x.id === o2.id);
  sib?.status === 'REJECTED' ? ok('sibling pending offer auto-REJECTED') : bad('sibling', sib?.status);

  console.log(`\n═══ RESULT: ${pass} passed / ${fail} failed ═══`);
  if (fail > 0) process.exit(1);
}
function m(r: any) { return r?.message ?? ''; }
let r: any;

main().catch((e) => { console.error('❌ FATAL:', e.message ?? e); process.exit(1); });
