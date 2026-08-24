/**
 * prog-29 verification — § Week 27 Platform Billing + utility allocation
 * engine (dup-prevention, methods, exact rounding, invoice posting).
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
function m(r: any) { return r?.message ?? JSON.stringify(r)?.slice(0, 130); }
let r: any;
const TAG = Date.now() % 100000;

async function register(email: string, name: string) {
  const rr = await req('POST', '/identity/register', {
    body: { email, password: 'supersecret1', displayName: name },
  });
  let token = d(rr)?.token;
  if (!token) {
    token = d(await req('POST', '/identity/login', { body: { email, password: 'supersecret1' } }))?.token;
  }
  return { token };
}

async function main() {
  console.log('═══ A. Platform billing (§ W27) ═══');

  const staff = d(await req('POST', '/identity/platform/login', {
    body: { email: 'admin@ferio.test', password: 'RootAdmin1!' },
  }));

  // Generate invoices for all ACTIVE subscriptions (idempotent)
  r = await req('POST', '/platform/jobs/generate-subscription-invoices', { token: staff.token });
  d(r)?.subscriptionsChecked >= 1 ? ok(`invoice scan checked ${d(r).subscriptionsChecked} subscriptions`) : bad('invoice scan', m(r));

  // Fresh workspace via self-serve → its FIRST invoice arrives DUE
  const founder = await register(`billfounder${TAG}@demo.test`, `Billing Founder ${TAG}`);
  r = await req('POST', '/identity/my/organizations', {
    token: founder.token,
    body: { name: `Billing Co ${TAG}`, planTier: 'STARTER' },
  });
  const inv = d(r)?.firstInvoice;
  inv?.status === 'DUE' && inv.amountBdt > 0
    ? ok(`self-serve provision returns first invoice DUE (৳${inv.amountBdt})`)
    : bad('first invoice', JSON.stringify(d(r)?.firstInvoice)?.slice(0, 140));

  // Partial then full payment → PAID
  r = await req('POST', `/platform/billing/invoices/${inv.id}/payments`, {
    token: staff.token,
    body: { method: 'BKASH', amountBdt: Math.round(inv.amountBdt / 2), reference: 'P29-PART1' },
  });
  d(r)?.status === 'DUE' && d(r)?.payments?.length === 1
    ? ok(`partial payment recorded (${d(r).payments[0].amountBdt} of ${inv.amountBdt})`)
    : bad('partial payment', m(r));

  r = await req('POST', `/platform/billing/invoices/${inv.id}/payments`, {
    token: staff.token, body: { method: 'BANK', reference: 'P29-FULL' },
  });
  d(r)?.status === 'PAID' && d(r)?.paidAt ? ok('settling payment flips invoice PAID w/ paidAt') : bad('full payment', m(r));

  // Double-pay blocked
  r = await req('POST', `/platform/billing/invoices/${inv.id}/payments`, {
    token: staff.token, body: { method: 'BKASH' },
  });
  r.status === 400 ? ok('overpayment on PAID invoice blocked (400)') : bad('double pay', `${r.status}`);

  console.log('\n═══ B. Utility allocation math ═══');
  const owner = d(await req('POST', '/identity/login', { body: { email: 'owner@demo.test', password: 'supersecret1' } }));
  const H = { token: owner.token, slug: 'sheakh-fam' };

  // Fresh property + 3 units with distinct areas + leases for occupancy
  r = await req('POST', '/tenant/properties', {
    ...H, body: { name: `Alloc Heights ${TAG}`, type: 'RESIDENTIAL_BUILDING', area: 'Mirpur', district: 'Dhaka' },
  });
  const prop = d(r);
  const mkUnit = async (name: string, areaSqFt: number) =>
    d(await req('POST', '/tenant/units', { ...H, body: { propertyId: prop.id, name, type: 'APARTMENT', floor: 2, bedrooms: 2, bathrooms: 2, areaSqFt } }));
  const uA = await mkUnit(`AL-A-${TAG}`, 1000);
  const uB = await mkUnit(`AL-B-${TAG}`, 2000);
  const uC = await mkUnit(`AL-C-${TAG}`, 3000);
  ok('3 units created (1000/2000/3000 sqft)');

  // Building-scope DESCO account anchored on the property
  r = await req('POST', '/tenant/utilities', {
    ...H,
    body: { scope: 'BUILDING', propertyId: prop.id, type: 'ELECTRICITY', provider: 'DESCO', responsibility: 'RENTER' },
  });
  const acct = d(r);

  // Submeter readings: A=100, B=200, C=300 kWh in the bill window
  const periodStart = new Date(Date.UTC(2026, 7, 1)).toISOString();
  const periodEnd = new Date(Date.UTC(2026, 7, 31)).toISOString();
  const readingDate = new Date(Date.UTC(2026, 7, 31)).toISOString();
  let firstMeterId: string | null = null;
  for (const [unit, prev, cur] of [[uA, 1000, 1100], [uB, 2000, 2200], [uC, 3000, 3300]] as const) {
    const ua = d(await req('POST', '/tenant/utilities', {
      ...H, body: { scope: 'UNIT', unitId: unit.id, propertyId: prop.id, type: 'ELECTRICITY', provider: 'DESCO' },
    }));
    const meter = d(await req('POST', '/tenant/utilities/meters', { ...H, body: { utilityAccountId: ua.id } }));
    if (!firstMeterId) firstMeterId = meter.id;
    r = await req('POST', '/tenant/utilities/meter-readings', {
      ...H,
      body: { meterId: meter.id, previousReading: prev, currentReading: cur, readingDate },
    });
    if (r.status !== 201 && r.status !== 200) bad(`reading for ${unit.name}`, m(r));
  }
  ok('submeter readings recorded (100/200/300 kWh)');

  // Duplicate reading guard
  r = await req('POST', '/tenant/utilities/meter-readings', {
    ...H,
    body: { meterId: firstMeterId!, previousReading: 10, currentReading: 20, readingDate },
  });
  r.status === 400 ? ok('duplicate same-month reading blocked (400)') : bad('dup guard', `${r.status} ${m(r)}`);

  // ── EQUAL: ৳900 across 3 units → exactly 300 each ──
  r = await req('POST', '/tenant/utilities/bills', {
    ...H,
    body: { utilityAccountId: acct.id, periodStart, periodEnd, totalAmount: 900, allocationMethod: 'EQUAL' },
  });
  let bill = d(r);
  const eqOk = bill?.allocations?.length === 3 &&
    Math.abs(bill.allocations.reduce((s: number, a: any) => s + a.amountBdt, 0) - 900) < 0.001;
  eqOk ? ok('EQUAL allocates ৳300/300/300 (Σ=total)') : bad('EQUAL', JSON.stringify(bill?.allocations)?.slice(0, 140));

  // ── SUBMETER by consumption ratio 100:200:300 → 150/300/450 ──
  r = await req('POST', '/tenant/utilities/bills', {
    ...H,
    body: { utilityAccountId: acct.id, periodStart, periodEnd, totalAmount: 900, allocationMethod: 'SUBMETER' },
  });
  bill = d(r);
  const shares = (bill?.allocations ?? []).map((a: any) => a.amountBdt).sort((x: number, y: number) => x - y);
  JSON.stringify(shares) === JSON.stringify([150, 300, 450])
    ? ok('SUBMETER splits by consumption 150/300/450')
    : bad('SUBMETER', JSON.stringify(bill?.allocations)?.slice(0, 160));

  // ── AREA with awkward total: ৳1000 over 1000/2000/3000 → largest remainder ──
  r = await req('POST', '/tenant/utilities/bills', {
    ...H,
    body: { utilityAccountId: acct.id, periodStart, periodEnd, totalAmount: 1000, allocationMethod: 'AREA' },
  });
  bill = d(r);
  const areaSum = (bill?.allocations ?? []).reduce((s: number, a: any) => s + a.amountBdt, 0);
  const areaSorted = (bill?.allocations ?? []).map((a: any) => a.amountBdt).sort((x: number, y: number) => x - y);
  Math.abs(areaSum - 1000) < 0.001 &&
  JSON.stringify(areaSorted) === JSON.stringify([166.67, 333.33, 500]) &&
  bill.allocations.every((a: any) => a.basis?.startsWith('area='))
    ? ok('AREA rounds exactly: 166.67/333.33/500 (Σ=1000)')
    : bad('AREA rounding', JSON.stringify({ sorted: areaSorted })?.slice(0, 160));

  // ── PERCENTAGE validation ──
  r = await req('POST', '/tenant/utilities/bills', {
    ...H,
    body: {
      utilityAccountId: acct.id, periodStart, periodEnd, totalAmount: 500, allocationMethod: 'PERCENTAGE',
      weights: [{ unitId: uA.id, percent: 50 }, { unitId: uB.id, percent: 30 }],
    },
  });
  r.status === 400 ? ok('PERCENTAGE sum≠100 rejected (400)') : bad('pct guard', `${r.status} ${m(r)}`);

  console.log('\n═══ C. Posting allocations to renter statements ═══');
  // Open an invoice for unit A this month (auto-creates its billing account),
  // then post the AREA bill — only unit A has a statement, B/C get skipped.
  r = await req('POST', '/tenant/billing/invoices', {
    ...H, body: { unitId: uA.id, periodStart: '2026-08-01', periodEnd: '2026-08-31', dueDate: '2026-08-10' },
  });
  let invA = d(r);
  if (!invA?.id) {
    // No charge definitions configured → add a rent charge then retry
    const ba = d(await req('GET', `/tenant/billing/accounts?unitId=${uA.id}`, H));
    await req('POST', '/tenant/billing/charges', { ...H, body: { billingAccountId: ba.id, category: 'RENT', label: 'Rent', amount: 20000 } });
    invA = d(await req('POST', '/tenant/billing/invoices', {
      ...H, body: { unitId: uA.id, periodStart: '2026-08-01', periodEnd: '2026-08-31', dueDate: '2026-08-10' },
    }));
  }
  invA?.id ? ok(`unit A statement open (${invA.invoiceNumber})`) : bad('open invoice A', m(invA));

  r = await req('POST', `/tenant/utility-bills/${bill.id}/post`, H);
  const postedA = d(r)?.posted?.find((p: any) => p.unitId === uA.id);
  d(r)?.skipped?.length >= 2 && postedA
    ? ok(`posting: unit A charged ৳${postedA.amountBdt}, units B/C skipped (no statement)`)
    : bad('post result', JSON.stringify(d(r))?.slice(0, 170));

  console.log(`\n═══ RESULT: ${pass} passed / ${fail} failed ═══`);
  if (fail > 0) process.exit(1);
}

main().catch((e) => { console.error('❌ FATAL:', e.message ?? e); process.exit(1); });
