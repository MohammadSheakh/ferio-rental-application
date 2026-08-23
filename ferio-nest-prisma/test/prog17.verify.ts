/** prog-17 verification: Broker CRM pipeline, conversion + expiry job. */
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

  // Inventory for conversion target
  let props = d(await req('GET', '/tenant/properties', H));
  if (!props?.length) {
    props = [d(await req('POST', '/tenant/properties', { ...H, body: { name: 'CRM Tower', type: 'RESIDENTIAL_BUILDING' } }))];
    ok('seed property created (fresh DB)');
  }
  const U = d(await req('POST', '/tenant/units', {
    ...H, body: { propertyId: props[0].id, name: `C-${Date.now() % 1000}`, type: 'APARTMENT', floor: 3, bedrooms: 2, bathrooms: 2 },
  }));
  ok(`conversion unit created (${U.name})`);

  console.log('═══ Lead pipeline ═══');
  let r = await req('POST', '/tenant/crm/leads', {
    ...H,
    body: {
      name: 'Prospect Rahat', phone: '01712345670', email: 'rahat@demo.test',
      source: 'MARKETPLACE_INQUIRY', interestedUnitId: U.id,
      assignedTo: 'user_scratch_1', brokerName: 'Rahman Brokers',
    },
  });
  const lead = d(r);
  lead?.status === 'NEW' ? ok('lead created (NEW)') : bad('lead create', r);

  r = await req('PATCH', `/tenant/crm/leads/${lead.id}?`, {
    ...H, body: { status: 'CONVERTED' },
  });
  /Cannot move lead/.test(m(r)) ? ok('illegal jump NEW→CONVERTED blocked') : bad('transition guard', m(r));

  for (const st of ['CONTACTED', 'VIEWING_SCHEDULED', 'NEGOTIATING']) {
    r = await req('PATCH', `/tenant/crm/leads/${lead.id}?`, { ...H, body: { status: st } });
    if (d(r)?.status !== st) { bad(`→ ${st}`, m(r)); }
  }
  ok('pipeline walked NEW→CONTACTED→VIEWING→NEGOTIATING');

  console.log('═══ Conversion ═══');
  r = await req('POST', `/tenant/crm/leads/${lead.id}/convert`, {
    ...H,
    body: {
      leadId: lead.id, unitId: U.id,
      startDate: '2026-10-01', endDate: '2027-09-30',
      monthlyRent: 45000, brokerCommissionPct: 50,
    },
  });
  if (d(r)?.leaseId) {
    ok(`converted → renter ${d(r).renterId.slice(-6)} · lease ACTIVE · commission ৳${d(r).commissionAmount}`);
  } else bad('convert', m(r));

  const unitsAfter = d(await req('GET', '/tenant/units', H));
  const convUnit = unitsAfter.find((u: any) => u.id === U.id);
  convUnit?.status === 'OCCUPIED' ? ok('unit now OCCUPIED') : bad('unit status', convUnit?.status);

  console.log('═══ Report ═══');
  r = await req('GET', '/tenant/crm/report', H);
  const rep = d(r);
  rep?.byStatus?.CONVERTED >= 1 && rep.conversionRatePct > 0
    ? ok(`report: ${rep.totalLeads} leads · conversion ${rep.conversionRatePct}% · assignee rows ${rep.byAssignee.length}`)
    : bad('report', JSON.stringify(rep)?.slice(0, 120));

  console.log('═══ LOST requires reason ═══');
  const l2 = d(await req('POST', '/tenant/crm/leads', { ...H, body: { name: 'Ghost Lead', source: 'WALK_IN' } }));
  await req('PATCH', `/tenant/crm/leads/${l2.id}?`, { ...H, body: { status: 'CONTACTED' } });
  const noReason = await req('PATCH', `/tenant/crm/leads/${l2.id}?`, { ...H, body: { status: 'LOST' } });
  /lostReason/.test(m(noReason)) ? ok('LOST without reason blocked') : bad('lost guard', m(noReason));
  const withReason = await req('PATCH', `/tenant/crm/leads/${l2.id}?`, { ...H, body: { status: 'LOST', lostReason: 'Went elsewhere' } });
  d(withReason)?.status === 'LOST' ? ok('LOST with reason accepted') : bad('lost with reason', m(withReason));

  console.log('═══ Listing expiry job ═══');
  const staff = d(await req('POST', '/identity/platform/login', {
    body: { email: 'admin@ferio.test', password: 'RootAdmin1!' },
  }));
  const staffTok = staff?.token;
  const seller = d(await req('GET', '/marketplace/accounts/me/demo_seed_seller'));
  const past = new Date(Date.now() - 86_400_000).toISOString();
  const expListing = d(await req('POST', `/marketplace/accounts/${seller.id}/listings`, {
    body: {
      purpose: 'RENT', assetType: 'APARTMENT', title: `Expiry probe ${Date.now()}`,
      price: 31000, area: 'Banani', expiresAt: past,
    },
  }));
  if (!expListing?.id) { bad('probe listing create', JSON.stringify(expListing ?? r).slice(0, 140)); }
  else {
    const j = d(await req('POST', '/platform/jobs/expire-listings', { token: staffTok }));
    (j?.expired ?? 0) >= 1 ? ok(`expiry scan expired ${j.expired} listing(s)`) : bad('expiry job', j);
    const after = d(await req('GET', `/marketplace/listings/${expListing.id}`));
    // expired listings are hidden from public detail (404) — verify via search instead
    const sr = await req('GET', `/marketplace/listings/search?area=Banani`);
    !(sr.data.items ?? []).some((i: any) => i.id === expListing.id)
      ? ok('expired listing removed from public search')
      : bad('still visible in search');
  }

  console.log(`\n═══ RESULT: ${pass} passed / ${fail} failed ═══`);
  if (fail > 0) process.exit(1);
}
function m(r: any) { return r?.message ?? ''; }

main().catch((e) => { console.error('❌ FATAL:', e.message ?? e); process.exit(1); });
