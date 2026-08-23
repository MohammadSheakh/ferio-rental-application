/**
 * prog-13 verification — Staff TOTP, member RBAC gates, Renter Portal.
 * Node-native (no bash quoting/timing fragility). Run:
 *   cd ferio-nest-prisma && node --input-type=module -e "..."  (see runner)
 * or: npx ts-node --transpile-only test/prog13.verify.ts
 */
import { totpAt } from '../src/infrastructure/identity/totp';
import { Client } from 'pg';

/** Idempotency: clear any prior TOTP enrollment for the test staff account. */
async function resetStaffTotp() {
  const client = new Client({
    connectionString:
      process.env.CONTROL_PLANE_DATABASE_URL ??
      'postgresql://postgres:testpass@localhost:5498/ferio_control',
  });
  await client.connect();
  await client.query(
    `UPDATE \"PlatformUser\" SET \"totpEnabled\" = false, \"totpSecret\" = NULL
     WHERE email = 'admin@ferio.test'`,
  );
  await client.end();
}

const B = process.env.API_BASE ?? 'http://localhost:6799/api/v1';
let pass = 0;
let fail = 0;

function ok(label: string) {
  pass++;
  console.log(`  ✅ ${label}`);
}
function bad(label: string, detail?: unknown) {
  fail++;
  console.log(`  ❌ ${label}${detail !== undefined ? ` → ${String(detail).slice(0, 160)}` : ''}`);
}

async function req(
  method: string,
  path: string,
  opts: { token?: string; tenantSlug?: string; body?: unknown } = {},
): Promise<any> {
  const res = await fetch(`${B}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
      ...(opts.tenantSlug ? { 'X-Tenant-Slug': opts.tenantSlug } : {}),
    },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, ...(json?.data !== undefined || json?.message ? json : json) };
}
const d = (r: any) => r?.data;
const m = (r: any) => r?.message ?? '';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  await resetStaffTotp();

  // ── 1. Staff TOTP ──
  console.log('═══ 1. Staff TOTP lifecycle ═══');
  let r = await req('POST', '/identity/platform/login', {
    body: { email: 'admin@ferio.test', password: 'RootAdmin1!' },
  });
  const ptok0 = d(r)?.token;
  ptok0 ? ok('staff login pre-TOTP') : bad('staff login', m(r));

  r = await req('POST', '/identity/platform/totp/setup', { token: ptok0 });
  const secret: string | undefined = d(r)?.secret;
  secret ? ok(`secret ${secret.slice(0, 8)}… · otpauth URI issued`) : bad('setup', m(r));

  const codeNow = () => totpAt(secret!, Math.floor(Date.now() / 1000));

  r = await req('POST', '/identity/platform/totp/confirm', {
    token: ptok0,
    body: { code: codeNow() },
  });
  d(r)?.enabled === true ? ok('confirmed with valid code') : bad('confirm', m(r));

  r = await req('POST', '/identity/platform/login', {
    body: { email: 'admin@ferio.test', password: 'RootAdmin1!' },
  });
  /TOTP code required/.test(m(r)) ? ok('login w/o code blocked') : bad('w/o code', m(r));

  r = await req('POST', '/identity/platform/login', {
    body: { email: 'admin@ferio.test', password: 'RootAdmin1!', code: codeNow() },
  });
  d(r)?.user?.role === 'SUPER_ADMIN'
    ? ok('login with valid code → SUPER_ADMIN')
    : bad('with code', m(r));

  r = await req('POST', '/identity/platform/totp/disable', {
    token: ptok0,
    body: { code: codeNow() },
  });
  d(r)?.enabled === false ? ok('disable with current code') : bad('disable', m(r));

  r = await req('POST', '/identity/platform/login', {
    body: { email: 'admin@ferio.test', password: 'RootAdmin1!' },
  });
  r.status === 200 ? ok('plain login post-disable (200)') : bad('post-disable', r.status);

  // ── 2. Member role gates ──
  console.log('═══ 2. Member role gates ═══');
  r = await req('POST', '/identity/login', {
    body: { email: 'owner@demo.test', password: 'supersecret1' },
  });
  const ownerTok = d(r)?.token;
  ownerTok ? ok('owner identity login') : bad('owner login', m(r));

  r = await req('POST', '/tenant/properties', {
    token: ownerTok,
    tenantSlug: 'sheakh-fam',
    body: { name: 'ACL Tower Three', type: 'RESIDENTIAL_BUILDING' },
  });
  const propertyId = d(r)?.id;
  propertyId ? ok('ORGANIZATION_OWNER writes inventory') : bad('owner create', m(r));

  r = await req('POST', '/identity/register', {
    body: { email: `acct${Date.now()}@demo.test`, password: 'supersecret1', displayName: 'Nusrat A' },
  });
  const acctTok = d(r).token;
  const acctId = (await req('GET', '/identity/me', { token: acctTok })).data.userId;

  r = await req('POST', '/tenant/iam/invites', {
    token: ownerTok,
    tenantSlug: 'sheakh-fam',
    body: { email: `acct${Date.now()}x@demo.test`, role: 'ACCOUNTANT' },
  });
  const inviteTok = d(r)?.token;
  inviteTok ? ok('owner invites ACCOUNTANT') : bad('invite', m(r));

  r = await req('POST', '/tenant/iam/invites/accept', {
    token: acctTok,
    tenantSlug: 'sheakh-fam',
    body: { token: inviteTok, displayName: 'Nusrat A' },
  });
  d(r)?.accepted ? ok('invite accepted (bound to authenticated identity)') : bad('accept', m(r));

  r = await req('POST', '/tenant/properties', {
    token: acctTok,
    tenantSlug: 'sheakh-fam',
    body: { name: 'Nope Tower', type: 'SHOP' },
  });
  r.status === 403
    ? ok(`ACCOUNTANT inventory write blocked (403): ${m(r)}`)
    : bad('acct write', `${r.status} ${m(r)}`);

  r = await req('GET', '/tenant/units', { token: acctTok, tenantSlug: 'sheakh-fam' });
  r.status === 200 ? ok('ACCOUNTANT reads units (200)') : bad('acct read', r.status);

  r = await req('POST', '/identity/register', {
    body: { email: `out${Date.now()}@demo.test`, password: 'supersecret1', displayName: 'Out' },
  });
  const outTok = d(r).token;
  r = await req('GET', '/tenant/units', { token: outTok, tenantSlug: 'sheakh-fam' });
  r.status === 403 ? ok('non-member read blocked (403)') : bad('outsider read', r.status);

  // ── 3. Renter portal ──
  console.log('═══ 3. Renter portal ═══');
  r = await req('POST', '/identity/register', {
    body: { email: `renter${Date.now()}@demo.test`, password: 'supersecret1', displayName: 'Rafiq R' },
  });
  const renterTok = d(r).token;
  const renterId = (await req('GET', '/identity/me', { token: renterTok })).data.userId;

  r = await req('POST', '/tenant/units', {
    token: ownerTok,
    tenantSlug: 'sheakh-fam',
    body: { propertyId, name: 'T-301', type: 'APARTMENT', floor: 30, bedrooms: 2, bathrooms: 2 },
  });
  const unitId = d(r)?.id;

  r = await req('POST', '/tenant/renters', {
    token: ownerTok,
    tenantSlug: 'sheakh-fam',
    body: { centralUserId: renterId, name: 'Rafiq R', phone: '01711000000', nidNumber: '1990123456789' },
  });
  const renterRowId = d(r)?.id;

  r = await req('POST', '/tenant/leases', {
    token: ownerTok,
    tenantSlug: 'sheakh-fam',
    body: {
      unitId, renterId: renterRowId,
      startDate: '2026-09-01', endDate: '2027-08-31',
      monthlyRent: 42000,
    },
  });
  d(r)?.id ? ok('ACTIVE lease bound to renter identity') : bad('lease', m(r));

  r = await req('GET', '/renter/me', { token: renterTok });
  const meOk = d(r)?.unit?.name === 'T-301' && d(r)?.organization?.slug === 'sheakh-fam';
  meOk
    ? ok(`renter/me → sheakh-fam · T-301 · outstanding ${d(r).outstandingBdt}`)
    : bad('renter/me', m(r) ?? JSON.stringify(d(r))?.slice(0, 120));

  r = await req('GET', `/tenant/billing/accounts?unitId=${unitId}`, {
    token: ownerTok, tenantSlug: 'sheakh-fam',
  });
  const baId = d(r)?.id;
  await req('POST', '/tenant/billing/charges', {
    token: ownerTok, tenantSlug: 'sheakh-fam',
    body: { billingAccountId: baId, category: 'RENT', label: 'Rent', amount: 42000 },
  });
  r = await req('POST', '/tenant/billing/invoices', {
    token: ownerTok, tenantSlug: 'sheakh-fam',
    body: { unitId, periodStart: '2026-11-01', periodEnd: '2026-11-30', dueDate: '2026-11-10' },
  });
  const invoiceId = d(r)?.id;
  invoiceId ? ok('invoice issued for tenancy') : bad('invoice', m(r));

  r = await req('POST', '/renter/payments', {
    token: renterTok,
    body: { invoiceId, method: 'BKASH', amount: 15000, reference: 'TXN-R13' },
  });
  const st = d(r)?.status;
  st === 'REPORTED' || st === 'PENDING'
    ? ok(`renter payment queued for verification (${st})`)
    : bad('report payment', m(r));

  r = await req('GET', '/renter/invoices', { token: renterTok });
  const invs = d(r);
  Array.isArray(invs) && invs.length >= 1 && invs[0].payments.length >= 1
    ? ok(`renter invoices → ${invs.length} statement(s); latest has ${invs[0].payments.length} payment(s)`)
    : bad('renter invoices');

  console.log(`\n═══ RESULT: ${pass} passed / ${fail} failed ═══`);
  if (fail > 0) process.exit(1);
}

main().catch((e) => {
  console.error('❌ FATAL:', e);
  process.exit(1);
});
