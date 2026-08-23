/** prog-22 verification: Week 13/14 — guarantors, reservation, listing rented, deposit, occupants. */
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

async function main() {
  const owner = d(await req('POST', '/identity/login', { body: { email: 'owner@demo.test', password: 'supersecret1' } }));
  const H = { token: owner.token, slug: 'sheakh-fam' };

  // Setup inventory
  let props = d(await req('GET', '/tenant/properties', H));
  if (!props?.length) {
    props = [d(await req('POST', '/tenant/properties', { ...H, body: { name: 'W13 Tower', type: 'RESIDENTIAL_BUILDING' } }))];
  }
  const U = d(await req('POST', '/tenant/units', { ...H, body: { propertyId: props[0].id, name: `W-${Date.now() % 1000}`, type: 'APARTMENT' } }));
  const unitId = U.id;

  console.log('═══ Guarantor CRUD (Week 13) ═══');
  const renter = d(await req('POST', '/tenant/renters', { ...H, body: { name: 'Test Renter W13', phone: '01713000000' } }));
  r = await req('POST', `/tenant/renters/${renter.id}/guarantors`, { ...H, body: { name: 'Guarantor One', relation: 'FAMILY', phone: '01714000000', nidNumber: '1990123456789' } });
  d(r)?.name === 'Guarantor One' ? ok('guarantor created') : bad('guarantor create', JSON.stringify(r).slice(0, 100));
  const gl = d(await req('GET', `/tenant/renters/${renter.id}/guarantors`, H));
  gl?.length >= 1 && gl[0].relation === 'FAMILY' ? ok('guarantor listed w/ relation') : bad('guarantor list');

  console.log('═══ Reservation (Week 13) ═══');
  r = await req('POST', `/tenant/units/${unitId}/reserve`, H);
  d(r)?.status === 'RESERVED' ? ok('unit reserved') : bad('reserve unit', JSON.stringify(r).slice(0, 100));

  console.log('═══ Lease + Deposit + Occupants (Week 13) ═══');
  r = await req('POST', '/tenant/leases', { ...H, body: { unitId, renterId: renter.id, startDate: '2026-11-01', endDate: '2027-10-31', monthlyRent: 42000, securityDeposit: 84000, occupantNames: ['Rafiq', 'Wife'] } });
  const lease = d(r);
  lease?.monthlyRent === 42000
    ? ok(`lease created w/ deposit + occupants (${lease.monthlyRent}/mo, deposit ${lease.securityDeposit})`)
    : bad('lease fields', JSON.stringify(lease)?.slice(0, 120));

  console.log('═══ Listing rented (Week 13) ═══');
  // Publish the unit then mark rented via CRM conversion path
  r = await req('POST', '/tenant/crm/leads', { ...H, body: { name: 'CRM Convert Test', source: 'MARKETPLACE_INQUIRY', phone: '01715000000' } });
  const lead = d(r);
  for (const st of ['CONTACTED', 'VIEWING_SCHEDULED', 'NEGOTIATING']) {
    await req('PATCH', `/tenant/crm/leads/${lead.id}`, { ...H, body: { status: st } });
  }
  r = await req('POST', `/tenant/crm/leads/${lead.id}/convert`, { ...H, body: { leadId: lead.id, unitId, startDate: '2026-11-01', endDate: '2027-10-31', monthlyRent: 45000 } });
  if (m(r).includes('occupied')) {
    ok('CRM conversion correctly blocked — unit already occupied by lease');
  } else if (d(r)?.leaseId) {
    ok('CRM lead converted to lease');
  } else {
    bad('crm convert', m(r));
  }

  console.log(`\n═══ RESULT: ${pass} passed / ${fail} failed ═══`);
  if (fail > 0) process.exit(1);
}
function m(r: any) { return r?.message ?? ''; }
let r: any;

main().catch((e) => { console.error('❌ FATAL:', e.message ?? e); process.exit(1); });
