/**
 * prog-32 verification — § Week 26 Custom Domains (mock-DNS mode) +
 * ledger widening (commission payout legs).
 */
import { request as httpRequest } from 'http';

const B = process.env.API_BASE ?? 'http://localhost:6799/api/v1';
let pass = 0, fail = 0;
const ok = (l: string) => { pass++; console.log(`  ✅ ${l}`); };
const bad = (l: string, d?: unknown) => { fail++; console.log(`  ❌ ${l}${d !== undefined ? ' → ' + String(d).slice(0, 170) : ''}`); };

async function req(method: string, path: string, o: { token?: string; slug?: string; body?: unknown; host?: string } = {}) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (o.token) headers.Authorization = `Bearer ${o.token}`;
  if (!o.host && o.slug) headers['X-Tenant-Slug'] = o.slug;
  const res = await fetch(`${B}${path}`, { method, headers, body: o.body === undefined ? undefined : JSON.stringify(o.body) });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, ...json };
}
const d = (r: any) => r?.data;
function m(r: any) { return r?.message ?? JSON.stringify(r)?.slice(0, 130); }
let r: any;
const TAG = Date.now() % 100000;

/** Raw request with an explicit Host header (bypasses fetch restrictions). */
function rawReq(method: string, path: string, hostHeader: string, token?: string): Promise<{ status: number | undefined; body: string }> {
  return new Promise((resolve) => {
    const r2 = httpRequest(
      { host: '127.0.0.1', port: 6799, path: `/api/v1${path}`, method, headers: { host: hostHeader, ...(token ? { Authorization: `Bearer ${token}` } : {}) } },
      (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => resolve({ status: res.statusCode, body }));
      },
    );
    r2.on('error', () => resolve({ status: 0, body: '' }));
    r2.end();
  });
}

const sleep = (ms: number) => new Promise((r3) => setTimeout(r3, ms));

async function main() {
  console.log('═══ A. Custom domain lifecycle (§ W26, mock DNS) ═══');

  const owner = d(await req('POST', '/identity/login', { body: { email: 'owner@demo.test', password: 'supersecret1' } }));
  const H = { token: owner.token, slug: 'sheakh-fam' };

  // Non-owner blocked
  const viewerTok =
    d(await req('POST', '/identity/register', { body: { email: `dom${TAG}@demo.test`, password: 'supersecret1', displayName: 'Dom V' } }))?.token ||
    d(await req('POST', '/identity/login', { body: { email: `dom${TAG}@demo.test`, password: 'supersecret1' } }))?.token;
  r = await req('POST', '/tenant/domains', { token: viewerTok, slug: 'sheakh-fam', body: { domain: 'x.test' } });
  r.status === 403 ? ok('non-owner cannot add domains (403)') : bad('owner guard', `${r.status}`);

  // ferio.com subdomains rejected
  r = await req('POST', '/tenant/domains', { ...H, body: { domain: 'rahman.ferio.com' } });
  r.status === 400 ? ok('ferio.com subdomains rejected (auto-provisioned)') : bad('suffix guard', `${r.status}`);

  // Add custom domain → instructions
  const DOMAIN = `portal.sheakhfam-${TAG}.verified.test`;
  r = await req('POST', '/tenant/domains', { ...H, body: { domain: DOMAIN } });
  const added = d(r);
  added?.domain === DOMAIN &&
    added?.isVerified === false &&
    added?.verification?.record === `_ferio-verify.${DOMAIN}` &&
    added?.verification?.value?.startsWith('ferio-verify=')
    ? ok(`domain added w/ TXT instructions (_ferio-verify record)`)
    : bad('add domain', JSON.stringify(added)?.slice(0, 170));

  console.log('\n═══ B. Unverified custom host must NOT resolve ═══');
  r = await rawReq('GET', '/tenant/utilities', DOMAIN, owner.token);
  r.status !== 200
    ? ok(`unverified host rejected (${r.status}) — takeover guard holds`)
    : bad('pre-verify resolve', 'unexpectedly resolved');

  console.log('\n═══ C. Verification via mock DNS ═══');
  r = await req('POST', `/tenant/domains/${added.id}/verify`, H);
  const verified = d(r);
  verified?.isVerified === true && verified?.sslStatus === 'ACTIVE'
    ? ok(`mock TXT proof passed → VERIFIED + ssl ACTIVE (${verified.checked})`)
    : bad('verify', m(r));

  // Host-based resolution now works (no X-Tenant-Slug)
  await sleep(1100); // middleware hostname cache TTL is 60s for negatives too
  r = await rawReq('GET', '/tenant/utilities', DOMAIN, owner.token);
  r.status === 200
    ? ok('verified custom domain resolves the workspace via Host header')
    : bad('host resolution', `${r.status} ${String(r.body).slice(0, 120)}`);

  console.log('\n═══ D. Primary + takeover protection ═══');
  r = await req('PATCH', `/tenant/domains/${added.id}/primary`, H);
  d(r)?.isPrimary === true ? ok('promoted to primary') : bad('primary', m(r));

  // Rival org cannot claim a VERIFIED domain
  const founderTok =
    d(await req('POST', '/identity/register', { body: { email: `domrival${TAG}@demo.test`, password: 'supersecret1', displayName: `Rival ${TAG}` } }))?.token ||
    d(await req('POST', '/identity/login', { body: { email: `domrival${TAG}@demo.test`, password: 'supersecret1' } }))?.token;
  r = await req('POST', '/identity/my/organizations', {
    token: founderTok,
    body: { name: `Domain Rival ${TAG}`, planTier: 'STARTER' },
  });
  const rivalSlug = d(r)?.slug;
  if (!rivalSlug) { bad('rival provision', m(r)); process.exit(1); }
  await sleep(6500); // entitlement/plan cache warm-up not needed here; keep small

  r = await req('POST', '/tenant/domains', {
    token: founderTok, slug: rivalSlug,
    body: { domain: DOMAIN },
  });
  r.status === 409 ? ok('verified domain takeover blocked (409)') : bad('takeover guard', `${r.status} ${m(r)}`);

  // Unverified same-domain from another org also blocked (unique)
  console.log('\n═══ E. Commission payout hits the ledger ═══');
  const U = d(await req('POST', '/tenant/units', {
    ...H, body: { propertyId: d(await req('GET', '/tenant/properties', H))[0].id, name: `CM-${TAG}`, type: 'APARTMENT', floor: 4, bedrooms: 3, bathrooms: 2 },
  }));
  r = await req('POST', '/tenant/crm/leads', {
    ...H, body: { name: 'Ledger Prospect', phone: '01777111222', source: 'REFERRAL', brokerName: 'Brokers BD' },
  });
  const lead = d(r);
  for (const st of ['CONTACTED', 'VIEWING_SCHEDULED', 'NEGOTIATING']) {
    await req('PATCH', `/tenant/crm/leads/${lead.id}`, { ...H, body: { status: st } });
  }
  r = await req('POST', `/tenant/crm/leads/${lead.id}/convert`, {
    ...H,
    body: { leadId: lead.id, unitId: U.id, startDate: '2027-01-01', endDate: '2027-12-31', monthlyRent: 42000, brokerCommissionPct: 50 },
  });
  const conv = d(r);
  conv?.payoutId ? ok('conversion created DUE payout') : bad('conversion', m(r));

  const before = d(await req('GET', '/tenant/reports/trial-balance', H));
  r = await req('POST', `/tenant/crm/payouts/${conv.payoutId}/settle`, {
    ...H, body: { method: 'BKASH', reference: 'P32-LEDGER', recordedBy: 'owner' },
  });
  d(r)?.status === 'PAID' ? ok('payout settled → PAID') : bad('settle', m(r));

  r = await req('GET', `/tenant/reports/ledger/${encodeURIComponent(`payout:${conv.payoutId}`)}`, H);
  const legs = Array.isArray(d(r)) ? d(r) : [];
  legs.some((l: any) => l.account === 'COMMISSION_EXPENSE' && l.debit === 21000) &&
  legs.some((l: any) => l.account === 'BKASH' && l.credit === 21000)
    ? ok('ledger group: COMMISSION_EXPENSE Dr 21,000 · BKASH Cr 21,000')
    : bad('payout legs', JSON.stringify(legs)?.slice(0, 180));

  const after = d(await req('GET', '/tenant/reports/trial-balance', H));
  after?.balanced && Math.abs(after.totalDebit - before.totalDebit - 21000) < 0.01
    ? ok(`trial balance still zero-drift (+৳21,000 both sides)`)
    : bad('trial balance delta', JSON.stringify({ b: before.totalDebit, a: after.totalDebit })?.slice(0, 120));

  console.log(`\n═══ RESULT: ${pass} passed / ${fail} failed ═══`);
  if (fail > 0) process.exit(1);
}

main().catch((e) => { console.error('❌ FATAL:', e.message ?? e); process.exit(1); });
