/** prog-21 verification: Unit Owner Portal (Week 29). */
const B = process.env.API_BASE ?? 'http://localhost:6799/api/v1';
let pass = 0, fail = 0;
const ok = (l: string) => { pass++; console.log(`  ✅ ${l}`); };
const bad = (l: string, d?: unknown) => { fail++; console.log(`  ❌ ${l}${d !== undefined ? ' → ' + (typeof d === 'object' ? JSON.stringify(d).slice(0, 200) : String(d).slice(0, 160)) : ''}`); };

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
const stamp = () => Date.now();

async function main() {
  const owner = d(await req('POST', '/identity/login', { body: { email: 'owner@demo.test', password: 'supersecret1' } }));
  const H = { token: owner.token, slug: 'sheakh-fam' };

  // ── Setup: co-owned unit w/ ACTIVE lease + partially paid invoice ──
  const oTok = await register(`own${stamp()}@demo.test`, 'Jalil Co-Owner');
  const oMe = d(await req('GET', '/identity/me', { token: oTok }));
  const ownerId = oMe.userId;

  const rP = await req('POST', '/tenant/properties', { ...H, body: { name: `Owner Portal Heights ${stamp()}`, type: 'RESIDENTIAL_BUILDING' } });
  const propId = d(rP)?.id;
  const rU = await req('POST', '/tenant/units', {
    ...H, body: { propertyId: propId, name: `OW-${stamp() % 1000}`, type: 'APARTMENT', floor: 9, bedrooms: 3, bathrooms: 2, areaSqFt: 1650 },
  });
  const unitId = d(rU)?.id;

  // Sultana holds 40%; Jalil holds 60%
  r = await req('POST', `/tenant/units/${unitId}/owners`, {
    ...H, body: { ownerName: 'Sultana Co-Owner', sharePercent: 40 },
  });
  d(r)?.id ? ok('co-owner stake created (40%)') : bad('co-owner stake', r);
  r = await req('POST', `/tenant/units/${unitId}/owners`, {
    ...H, body: { ownerName: 'Jalil Co-Owner', ownerCentralUserId: ownerId, sharePercent: 60 },
  });
  d(r)?.id ? ok('ownership stake created for portal identity (60%)') : bad('add owner', r);

  const renter = d(await req('POST', '/tenant/renters', { ...H, body: { name: 'Renter Rafiq', phone: '01712000000' } }));
  r = await req('POST', '/tenant/leases', {
    ...H, body: { unitId, renterId: renter.id, startDate: '2026-10-01', endDate: '2027-09-30', monthlyRent: 50000 },
  });
  d(r)?.status === 'ACTIVE' ? ok('ACTIVE lease → expected rent computable') : bad('lease', m(r));

  const ba = d(await req('GET', `/tenant/billing/accounts?unitId=${unitId}`, H));
  await req('POST', '/tenant/billing/charges', { ...H, body: { billingAccountId: ba.id, category: 'RENT', label: 'Rent', amount: 50000 } });
  const inv = d(await req('POST', '/tenant/billing/invoices', { ...H, body: { unitId, periodStart: '2026-11-01', periodEnd: '2026-11-30', dueDate: '2026-11-10' } }));
  await req('POST', '/tenant/billing/payments', { ...H, body: { invoiceId: inv.id, method: 'BKASH', amount: 20000, reference: 'PARTIAL-1' } });

  // ── Portal reads ──
  console.log('═══ Owner /me ═══');
  const me = d(await req('GET', '/owner/me', { token: oTok }));
  if (!me?.units?.length) { bad('/owner/me empty', JSON.stringify(me).slice(0, 140)); process.exit(1); }
  const u0 = me.units[0];
  u0.mySharePercent === 60 && u0.lease.monthlyRent === 50000
    ? ok(`expectedMonthlyRent = ${me.totals.expectedMonthlyRentBdt} (60% share)`)
    : bad('expected rent math', JSON.stringify(u0).slice(0, 140));
  u0.coOwners.length >= 1 ? ok('co-owners surfaced') : bad('coOwners missing');
  me.units.every((x: any) => x.outstandingBdt !== undefined) ? ok('outstanding computed per unit') : bad('outstanding');

  console.log('═══ Statements ═══');
  const invs = d(await req('GET', '/owner/invoices', { token: oTok }));
  Array.isArray(invs) && invs.some((i: any) => i.id === inv.id)
    ? ok('consolidated statements include the tenancy invoice')
    : bad('statements missing invoice');

  console.log('═══ Maintenance visibility ═══');
  const mrResp = await req('POST', '/tenant/maintenance', { ...H, body: { unitId, scope: 'UNIT', urgency: 'NORMAL', title: 'Tap leaking', payer: 'UNIT_OWNER' } });
  console.log('   [dbg] maintenance POST:', JSON.stringify(mrResp).slice(0, 160));
  const maint = d(await req('GET', '/owner/maintenance', { token: oTok }));
  Array.isArray(maint) && maint.some((t: any) => t.unitId === unitId)
    ? ok('maintenance tickets visible for owned unit')
    : bad('maintenance list', JSON.stringify(maint)?.slice(0, 140));

  // outsider must see nothing
  const xtok = await register(`outsider${stamp()}@demo.test`, 'Nobody');
  const xr = await req('GET', '/owner/me', { token: xtok });
  xr.status === 404 ? ok('non-owner gets clean 404 (no leak)') : bad('outsider', xr.status);

  console.log(`\n═══ RESULT: ${pass} passed / ${fail} failed ═══`);
  if (fail > 0) process.exit(1);
}
function m(r: any) { return r?.message ?? ''; }
let r: any;

async function register(email: string, name: string) {
  return d(await req('POST', '/identity/register', { body: { email, password: 'supersecret1', displayName: name } }))?.token;
}

main().catch((e) => { console.error('❌ FATAL:', e.message ?? e); process.exit(1); });
