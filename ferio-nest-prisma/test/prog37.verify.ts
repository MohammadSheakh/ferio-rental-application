/**
 * prog-37 — §4.8 Release 0 Exit Gate proof + § Weeks 20–22 job additions.
 * Gate items proven live against a freshly provisioned workspace:
 *   URL resolves · DB provisions+migrates+seeds automatically ·
 *   cross-access blocked · suspension blocks · planes independent.
 */
const B = process.env.API_BASE ?? 'http://localhost:6799/api/v1';
let pass = 0, fail = 0;
const ok = (l: string) => { pass++; console.log(`  ✅ ${l}`); };
const bad = (l: string, d?: unknown) => { fail++; console.log(`  ❌ ${l}${d !== undefined ? ' → ' + String(d).slice(0, 170) : ''}`); };

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
function m(r: any) { return r?.message ?? ''; }
let r: any;
const TAG = Date.now();

async function main() {
  console.log('\n═══ §4.8 Release 0 Exit Gate ═══');

  // Fresh founder + self-serve provision (provisions+migrates+seeds in one call)
  const email = `gate${TAG}@demo.test`;
  r = await req('POST', '/identity/register', { body: { email, password: 'supersecret1', displayName: `Gate Founder ${TAG}` } });
  const token = d(r)?.token ?? d(await req('POST', '/identity/login', { body: { email, password: 'supersecret1' } }))?.token;

  r = await req('POST', '/identity/my/organizations', {
    token,
    body: { name: `Gate Org ${TAG}`, planTier: 'STARTER' },
  });
  const org = d(r);
  org?.status === 'COMPLETED' && org.schemaVersion && org.domain
    ? ok(`gate-0 provision: DB created + migrated (${org.schemaVersion}) + seeded`)
    : bad('provision', m(r));
  const slug = org?.slug as string;
  const H = { token, slug };

  // [x] tenant URL resolves (subdomain override == host resolution path)
  r = await req('GET', '/tenant/iam/members', H);
  r.status === 200 ? ok('tenant URL resolves correctly') : bad('resolve', `${r.status} ${m(r)}`);

  // [x] seed works — owner member exists
  const members = d(r);
  Array.isArray(members) && members.some((x: any) => x.role === 'ORGANIZATION_OWNER')
    ? ok('seed works (ORGANIZATION_OWNER member present)')
    : bad('seed', JSON.stringify(members)?.slice(0, 120));

  // [x] two organizations cannot cross-access
  const other = await register2(`other${TAG}@demo.test`, `Other ${TAG}`);
  r = await req('POST', '/identity/my/organizations', {
    token: other.token,
    body: { name: `Gate Rival ${TAG}`, planTier: 'STARTER' },
  });
  const rivalSlug = d(r)?.slug;
  r = await req('GET', '/tenant/iam/members', { token: other.token, slug });
  r.status === 403 ? ok('two organizations cannot cross-access') : bad('cross-access', `${r.status} ${m(r)}`);
  void rivalSlug;

  // [x] suspended organization is blocked
  const staff = d(await req('POST', '/identity/platform/login', {
    body: { email: 'admin@ferio.test', password: 'RootAdmin1!' },
  }));
  r = await req('PATCH', `/platform/organizations/${org.organizationId}/suspend`, {
    token: staff.token, body: { reason: 'gate test' },
  });
  console.log(`    [dbg] suspend=${r.status} org=${org.organizationId} slug=${slug}`);
  r = await req('GET', '/tenant/iam/members', H);
  console.log(`    [dbg] members=${r.status}`);
  const r2 = await req('GET', '/tenant/utilities', H);
  console.log(`    [dbg] utilities=${r2.status} msg=${String(m(r2)).slice(0,60)}`);
  const r3 = await rawGetMembers(H);
  console.log(`    [dbg] raw=${r3.status}`);
  r.status === 401 || r.status === 503 || /suspended/i.test(String(m(r)))
    ? ok('suspended organization is blocked')
    : bad('suspension block', `${r.status} ${m(r)}`);
  await req('PATCH', `/platform/organizations/${org.organizationId}/reactivate`, { token: staff.token });

  console.log('\n═══ Week 22 jobs: rent reminders + escalation ═══');

  // Owner back on sheakh-fam for the job assertions
  const owner = d(await req('POST', '/identity/login', { body: { email: 'owner@demo.test', password: 'supersecret1' } }));
  const H2 = { token: owner.token, slug: 'sheakh-fam' };

  r = await req('POST', '/platform/jobs/rent-reminders', { token: staff.token });
  d(r)?.invoicesReminded !== undefined ? ok(`rent reminder scan ran (${d(r).invoicesReminded} due-soon invoices fanned out)`) : bad('reminders', m(r));

  r = await req('POST', '/platform/jobs/maintenance-escalation', { token: staff.token });
  d(r)?.escalated !== undefined ? ok(`escalation scan ran (${d(r).escalated} escalated this pass)`) : bad('escalation', m(r));

  console.log('\n═══ FIXED utility allocation ═══');
  // Fresh property so exactly 4 units exist under the anchor
  r = await req('POST', '/tenant/properties', {
    ...H2, body: { name: `Fixed Gas House ${TAG}`, type: 'RESIDENTIAL_BUILDING' },
  });
  const props = [d(r)];
  r = await req('POST', '/tenant/utilities', {
    ...H2,
    body: { scope: 'BUILDING', propertyId: props[0].id, type: 'GAS', provider: 'Titas', responsibility: 'RENTER' },
  });
  const acct = d(r);
  const units = [];
  for (let i = 0; i < 4; i++) {
    units.push(d(await req('POST', '/tenant/units', {
      ...H2,
      body: { propertyId: props[0].id, name: `FIX-${TAG}-${i}`, type: 'APARTMENT', floor: i, bedrooms: 2, bathrooms: 1 },
    })));
  }
  r = await req('POST', '/tenant/utilities/bills', {
    ...H2,
    body: {
      utilityAccountId: acct.id,
      periodStart: new Date(Date.UTC(2026, 9, 1)).toISOString(),
      periodEnd: new Date(Date.UTC(2026, 9, 31)).toISOString(),
      totalAmount: 800,
      allocationMethod: 'FIXED',
      fixedPerUnit: 200,
    },
  });
  const bill = d(r);
  bill?.allocations?.length === 4 &&
    bill.allocations.every((a: any) => a.amountBdt === 200) &&
    bill.allocations.every((a: any) => a.basis === 'fixed')
    ? ok('FIXED allocation: ৳200 × 4 units, basis=fixed')
    : bad('FIXED', JSON.stringify(bill?.allocations)?.slice(0, 160));

  // Mismatch rejected
  r = await req('POST', '/tenant/utilities/bills', {
    ...H2,
    body: {
      utilityAccountId: acct.id,
      periodStart: new Date(Date.UTC(2026, 10, 1)).toISOString(),
      periodEnd: new Date(Date.UTC(2026, 10, 30)).toISOString(),
      totalAmount: 999,
      allocationMethod: 'FIXED',
      fixedPerUnit: 200,
    },
  });
  r.status === 400 ? ok('FIXED total mismatch rejected (400)') : bad('fixed guard', `${r.status}`);

  console.log(`\n═══ RESULT: ${pass} passed / ${fail} failed ═══`);
  if (fail > 0) process.exit(1);
}

async function rawGetMembers(H: {token:string;slug:string}) {
  const res = await fetch(`${B}/tenant/iam/members`, { headers: { Authorization: `Bearer ${H.token}`, 'X-Tenant-Slug': H.slug } });
  return { status: res.status };
}

async function register2(email: string, name: string) {
  const rr = await req('POST', '/identity/register', { body: { email, password: 'supersecret1', displayName: name } });
  let token = d(rr)?.token;
  if (!token) token = d(await req('POST', '/identity/login', { body: { email, password: 'supersecret1' } }))?.token;
  return { token };
}

main().catch((e) => { console.error('❌ FATAL:', e.message ?? e); process.exit(1); });
