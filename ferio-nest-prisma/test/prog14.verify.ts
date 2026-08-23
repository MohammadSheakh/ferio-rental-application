/** prog-14 verification: renter utilities + maintenance flows. */
import { totpAt } from '../src/infrastructure/identity/totp';
import { Client } from 'pg';

const B = process.env.API_BASE ?? 'http://localhost:6799/api/v1';
let pass = 0, fail = 0;
const ok = (l: string) => { pass++; console.log(`  ✅ ${l}`); };
const bad = (l: string, d?: unknown) => { fail++; console.log(`  ❌ ${l}${d !== undefined ? ' → ' + String(d).slice(0, 150) : ''}`); };

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
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function resetStaff() {
  const c = new Client({ connectionString: process.env.CONTROL_PLANE_DATABASE_URL ?? 'postgresql://postgres:testpass@localhost:5498/ferio_control' });
  await c.connect();
  await c.query(`UPDATE "PlatformUser" SET "totpEnabled"=false, "totpSecret"=NULL WHERE email='admin@ferio.test'`);
  await c.end();
}

async function main() {
  await resetStaff();

  // identities
  const owner = d(await req('POST', '/identity/login', { body: { email: 'owner@demo.test', password: 'supersecret1' } }));
  let renter = d(await req('POST', '/identity/login', { body: { email: 'renter13@demo.test', password: 'supersecret1' } }));

  console.log('═══ Provision self-contained tenancy ═══');
  const props = d(await req('GET', '/tenant/properties', { token: owner.token, slug: 'sheakh-fam' }));
  const prop = props[0];
  const U = d(await req('POST', '/tenant/units', { token: owner.token, slug: 'sheakh-fam', body: { propertyId: prop.id, name: `R-${Date.now() % 1000}`, type: 'APARTMENT', floor: 2, bedrooms: 2, bathrooms: 1, areaSqFt: 950 } }));
  const RN = d(await req('POST', '/tenant/renters', { token: owner.token, slug: 'sheakh-fam', body: { centralUserId: renter.user.userId, name: 'Renter Thirteen', phone: '01711999999' } }));
  await req('POST', '/tenant/leases', { token: owner.token, slug: 'sheakh-fam', body: { unitId: U.id, renterId: RN.id, startDate: '2026-10-01', endDate: '2027-09-30', monthlyRent: 39000 } });
  const unit = U;
  ok(`tenancy provisioned: ${U.name} for ${renter.user.email}`);

  const ua = d(await req('POST', '/tenant/utilities', { token: owner.token, slug: 'sheakh-fam', body: { unitId: unit.id, scope: 'UNIT', type: 'ELECTRICITY', provider: 'DESCO', responsibility: 'RENTER' } }));
  const meter = d(await req('POST', '/tenant/utilities/meters', { token: owner.token, slug: 'sheakh-fam', body: { utilityAccountId: ua.id, meterNumber: 'DESCO-991' } }));
  await req('POST', '/tenant/utilities/meter-readings', { token: owner.token, slug: 'sheakh-fam', body: { meterId: meter.id, previousReading: 100, currentReading: 260, readingDate: new Date().toISOString(), readerName: 'Caretaker' } });

  const ru = d(await req('GET', '/renter/utilities', { token: renter.token }));
  Array.isArray(ru) && ru[0]?.type === 'ELECTRICITY' && ru[0].meters[0]?.readings[0]
    ? ok(`renter sees DESCO meter reading (${ru[0].meters[0].readings[0].currentReading} kWh)`)
    : bad('renter utilities', JSON.stringify(ru)?.slice(0, 120));

  console.log('═══ Renter maintenance ═══');
  const t = d(await req('POST', '/renter/maintenance', {
    token: renter.token,
    body: { title: 'Kitchen tap leaking', description: 'Water pooling under sink', urgency: 'URGENT' },
  }));
  t?.status === 'OPEN' && t?.scope === 'UNIT'
    ? ok(`ticket opened UNIT-scoped (${t.id.slice(-6)})`)
    : bad('create ticket', JSON.stringify(t)?.slice(0, 120));

  const list = d(await req('GET', '/renter/maintenance', { token: renter.token }));
  list.some((x: any) => x.id === t.id) ? ok('renter sees own ticket') : bad('list ticket');

  const ownerList = d(await req('GET', '/tenant/maintenance', { token: owner.token, slug: 'sheakh-fam' }));
  ownerList?.some((x: any) => x.id === t.id)
    ? ok('management sees the ticket in workspace queue')
    : bad('owner maintenance list', JSON.stringify(ownerList)?.slice(0, 100));

  console.log(`\n═══ RESULT: ${pass} passed / ${fail} failed ═══`);
  if (fail > 0) process.exit(1);
}

main().catch((e) => { console.error('❌ FATAL:', e.message ?? e); process.exit(1); });
