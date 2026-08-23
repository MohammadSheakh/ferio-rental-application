/** prog-16 verification: renter notices + documents (staff post → renter view). */
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

async function main() {
  const owner = d(await req('POST', '/identity/login', { body: { email: 'owner@demo.test', password: 'supersecret1' } }));
  let renter = d(await req('POST', '/identity/login', { body: { email: 'renter13@demo.test', password: 'supersecret1' } }));

  // Locate the renter's current unit via /renter/me
  const me = d(await req('GET', '/renter/me', { token: renter.token }));
  if (!me?.unit?.name) { bad('tenancy exists', me); process.exit(1); }
  ok(`tenancy: ${me.organization.slug} · ${me.unit.name}`);

  // Resolve unit id via owner API
  const units = d(await req('GET', '/tenant/units', { token: owner.token, slug: 'sheakh-fam' }));
  const unitId = units.find((u: any) => u.name === me.unit.name)?.id;
  ok(`unit resolved (${unitId?.slice(-6)})`);

  console.log('═══ Notices ═══');
  await req('POST', '/tenant/notices', {
    token: owner.token, slug: 'sheakh-fam',
    body: { title: 'Water shutdown Saturday 9–11am', body: 'Building-wide maintenance by WASA.' },
  });
  await req('POST', '/tenant/notices', {
    token: owner.token, slug: 'sheakh-fam',
    body: { title: 'Lift servicing — your floor affected', unitId },
  });
  ok('org-wide + unit notices posted');

  const rn = d(await req('GET', '/renter/notices', { token: renter.token }));
  if (!Array.isArray(rn)) { bad('renter notices list', JSON.stringify(rn).slice(0, 100)); }
  else {
    const titles = rn.map((n) => n.title);
    titles.some((t) => t.includes('Water shutdown')) && titles.some((t) => t.includes('your floor'))
      ? ok(`renter sees org-wide + unit notices (${rn.length})`)
      : bad('notice visibility', JSON.stringify(titles));
  }

  console.log('═══ Documents ═══');
  await req('POST', '/tenant/documents', {
    token: owner.token, slug: 'sheakh-fam',
    body: { category: 'LEASE', name: 'Signed Lease Agreement.pdf', fileUrl: 'https://files.ferio.test/lease.pdf', attachedToType: 'LEASE', attachedToId: me.lease.id },
  });
  await req('POST', '/tenant/documents', {
    token: owner.token, slug: 'sheakh-fam',
    body: { category: 'UNIT', name: 'Unit handover checklist.pdf', fileUrl: 'https://files.ferio.test/handover.pdf', attachedToType: 'UNIT', attachedToId: unitId },
  });
  ok('lease + unit documents attached');

  const rd = d(await req('GET', '/renter/documents', { token: renter.token }));
  Array.isArray(rd) && rd.length === 2
    ? ok(`renter sees tenancy documents (${rd.map((x) => x.category).join(', ')})`)
    : bad('documents visibility', JSON.stringify(rd)?.slice(0, 120));

  // Documents attached elsewhere must NOT leak
  await req('POST', '/tenant/documents', {
    token: owner.token, slug: 'sheakh-fam',
    body: { category: 'OTHER', name: 'Other-unit doc', fileUrl: 'https://x.test/other.pdf', attachedToType: 'UNIT', attachedToId: units.find((u: any) => u.id !== unitId)?.id ?? 'none' },
  });
  const rd2 = d(await req('GET', '/renter/documents', { token: renter.token }));
  !(rd2 as any[]).some((x) => x.name === 'Other-unit doc')
    ? ok('foreign-unit documents not leaked')
    : bad('document isolation');

  console.log(`\n═══ RESULT: ${pass} passed / ${fail} failed ═══`);
  if (fail > 0) process.exit(1);
}

main().catch((e) => { console.error('❌ FATAL:', e.message ?? e); process.exit(1); });
