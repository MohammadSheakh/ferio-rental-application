/** prog-20 verification: Week 30 tail — viewings per lead + commission payout ledger. */
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

  // Inventory
  let props = d(await req('GET', '/tenant/properties', H));
  if (!props?.length) {
    props = [d(await req('POST', '/tenant/properties', { ...H, body: { name: 'Prog20 Tower', type: 'RESIDENTIAL_BUILDING' } }))];
  }
  const U = d(await req('POST', '/tenant/units', {
    ...H, body: { propertyId: props[0].id, name: `P-${Date.now() % 1000}`, type: 'APARTMENT', floor: 7, bedrooms: 3, bathrooms: 2 },
  }));
  ok(`unit ${U.name} created`);

  // Lead → pipeline → convert with commission
  r = await req('POST', '/tenant/crm/leads', {
    ...H,
    body: { name: 'Payout Prospect', phone: '01716000000', source: 'REFERRAL', brokerName: 'Rahman Brokers' },
  });
  const lead = d(r);
  for (const st of ['CONTACTED', 'VIEWING_SCHEDULED', 'NEGOTIATING']) {
    await req('PATCH', `/tenant/crm/leads/${lead.id}`, { ...H, body: { status: st } });
  }
  r = await req('POST', `/tenant/crm/leads/${lead.id}/convert`, {
    ...H,
    body: { leadId: lead.id, unitId: U.id, startDate: '2026-11-01', endDate: '2027-10-31', monthlyRent: 40000, brokerCommissionPct: 50 },
  });
  const conv = d(r);
  conv?.payoutId ? ok(`converted · payout auto-created DUE (${conv.payoutId.slice(-6)})`) : bad('convert/payout', m(r));

  console.log('═══ Viewings ═══');
  r = await req('POST', `/tenant/crm/leads/${lead.id}/viewings`, {
    ...H, body: { scheduledAt: new Date(Date.now() + 86_400_000).toISOString(), notes: 'Second visit w/ family' },
  });
  const v = d(r);
  v?.status === 'SCHEDULED' ? ok('viewing scheduled') : bad('schedule viewing', m(r));

  r = await req('PATCH', `/tenant/crm/viewings/${v.id}`, { ...H, body: { status: 'COMPLETED', notes: 'Went well' } });
  d(r)?.status === 'COMPLETED' ? ok('viewing marked COMPLETED') : bad('complete viewing', m(r));

  const vl = d(await req('GET', `/tenant/crm/leads/${lead.id}/viewings`, H));
  Array.isArray(vl) && vl.length === 1 && vl[0].status === 'COMPLETED'
    ? ok('lead viewings list correct')
    : bad('list viewings', JSON.stringify(vl)?.slice(0, 100));

  console.log('═══ Commission payout ═══');
  let payouts = d(await req('GET', '/tenant/crm/payouts?status=DUE', H));
  const due = payouts.find((p: any) => p.leaseId === conv.leaseId);
  due && due.amount === 20000
    ? ok(`DUE payout visible (${due.brokerName} · ৳${due.amount} · ${due.lease.brokerCommissionPct}%)`)
    : bad('due payout', JSON.stringify(payouts)?.slice(0, 140));

  r = await req('POST', `/tenant/crm/payouts/${due.id}/settle`, {
    ...H, body: { method: 'BKASH', reference: 'PO-8891', recordedBy: owner.userId },
  });
  d(r)?.status === 'PAID' ? ok('payout settled → PAID') : bad('settle', m(r));

  payouts = d(await req('GET', '/tenant/crm/payouts?status=DUE', H));
  !payouts.some((p: any) => p.id === due.id)
    ? ok('settled payout no longer in DUE list')
    : bad('still DUE');

  // double-settle guard
  r = await req('POST', `/tenant/crm/payouts/${due.id}/settle`, {
    ...H, body: { method: 'CASH', recordedBy: owner.userId },
  });
  r.status === 400 ? ok('double-settle blocked (400)') : bad('double settle', r.status);

  console.log(`\n═══ RESULT: ${pass} passed / ${fail} failed ═══`);
  if (fail > 0) process.exit(1);
}
function m(r: any) { return r?.message ?? ''; }
let r: any;

main().catch((e) => { console.error('❌ FATAL:', e.message ?? e); process.exit(1); });
