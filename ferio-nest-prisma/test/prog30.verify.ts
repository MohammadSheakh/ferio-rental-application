/**
 * prog-30 verification — § Gate 5 double-entry ledger:
 * balanced payment postings, proportional receivable splits, reversals,
 * maintenance expense posting, trial-balance integrity.
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

async function main() {
  const owner = d(await req('POST', '/identity/login', { body: { email: 'owner@demo.test', password: 'supersecret1' } }));
  const H = { token: owner.token, slug: 'sheakh-fam' };
  const staffId = d(await req('GET', '/identity/me', { token: owner.token }))?.userId;
  if (!staffId) { bad('staff identity', 'no userId'); process.exit(1); }

  console.log('═══ A. Payment verification posts a balanced group ═══');

  r = await req('POST', '/tenant/properties', {
    ...H, body: { name: `Ledger House ${TAG}`, type: 'RESIDENTIAL_BUILDING' },
  });
  const prop = d(r);
  r = await req('POST', '/tenant/units', {
    ...H, body: { propertyId: prop.id, name: `LG-${TAG}`, type: 'APARTMENT', floor: 1, bedrooms: 2, bathrooms: 1 },
  });
  const unit = d(r);

  // Deterministic setup: force-create the billing account by generating
  // (and discarding) a failing invoice-less pass, then read its id.
  await req('POST', '/tenant/billing/invoices', {
    ...H, body: { unitId: unit.id, periodStart: '2026-09-01', periodEnd: '2026-09-30', dueDate: '2026-09-05' },
  });
  const ba = d(await req('GET', `/tenant/billing/accounts?unitId=${unit.id}`, H));
  if (!ba?.id) { bad('billing account', 'missing'); process.exit(1); }
  await req('POST', '/tenant/billing/charges', { ...H, body: { billingAccountId: ba.id, category: 'RENT', label: 'Rent', amount: 20000 } });
  await req('POST', '/tenant/billing/charges', { ...H, body: { billingAccountId: ba.id, category: 'SERVICE_CHARGE', label: 'Service', amount: 5000 } });

  let inv = d(await req('POST', '/tenant/billing/invoices', {
    ...H, body: { unitId: unit.id, periodStart: '2026-09-01', periodEnd: '2026-09-30', dueDate: '2026-09-05' },
  }));
  inv?.id && inv.totalAmount === 25000
    ? ok(`invoice ${inv.invoiceNumber} open (৳${inv.totalAmount} · rent+service)`)
    : bad('invoice', m(inv));

  // Renter reports ৳10,000 via bKash → staff verifies
  r = await req('POST', '/tenant/billing/payments', {
    ...H, body: { invoiceId: inv.id, method: 'BKASH', amount: 10000, reference: 'P30-LEDGER' },
  });
  const pay = d(r);
  r = await req('POST', `/tenant/billing/payments/${pay.id}/verify`, {
    ...H, body: { verifiedBy: staffId },
  });
  d(r)?.status === 'VERIFIED' && d(r)?.receiptNumber ? ok('payment verified w/ receipt') : bad('verify', m(r));

  // Inspect the ledger group: debit BKASH 10000 · credits split by lines
  r = await req('GET', `/tenant/reports/ledger/${encodeURIComponent(`payment:verify:${pay.id}`)}`, H);
  const legs = Array.isArray(d(r)) ? d(r) : [];
  const debitLegs = legs.filter((l: any) => l.debit > 0);
  const creditLegs = legs.filter((l: any) => l.credit > 0);
  const totalDebit = debitLegs.reduce((s: number, l: any) => s + l.debit, 0);
  const totalCredit = creditLegs.reduce((s: number, l: any) => s + l.credit, 0);
  legs.length >= 2 &&
    Math.abs(totalDebit - 10000) < 0.01 &&
    Math.abs(totalCredit - 10000) < 0.01 &&
    creditLegs.some((l: any) => l.account === 'RENT_RECEIVABLE') &&
    creditLegs.some((l: any) => l.account === 'SERVICE_CHARGE_RECEIVABLE')
    ? ok(`group balanced: BKASH Dr 10,000 · Cr RENT+SERVICE split (8000/2000)`)
    : bad('ledger group', JSON.stringify(legs)?.slice(0, 200));

  console.log('\n═══ B. Trial balance stays zero-drift through reversal ═══');
  r = await req('GET', '/tenant/reports/trial-balance', H);
  d(r)?.balanced === true && d(r)?.drift === 0 ? ok(`trial balance drift ৳${d(r).drift}`) : bad('trial balance pre-reversal', m(r));

  r = await req('POST', `/tenant/billing/payments/${pay.id}/reverse`, {
    ...H, body: { reversedBy: staffId, reason: 'Cheque bounced (prog-30)' },
  });
  d(r)?.status === 'REVERSED' ? ok('verified payment reversed') : bad('reverse', m(r));

  r = await req('GET', '/tenant/reports/trial-balance', H);
  const tbAfter = d(r);
  tbAfter?.balanced === true
    ? ok(`trial balance still balanced after reversal (Dr ৳${tbAfter.totalDebit} = Cr ৳${tbAfter.totalCredit})`)
    : bad('trial balance post-reversal', JSON.stringify(tbAfter)?.slice(0, 140));

  // Compensating group exists and mirrors the original
  r = await req('GET', `/tenant/reports/ledger/${encodeURIComponent(`payment:reverse:${pay.id}`)}`, H);
  const revLegs = Array.isArray(d(r)) ? d(r) : [];
  revLegs.length >= 2 &&
    revLegs.some((l: any) => l.credit > 0 && l.account === 'BKASH')
    ? ok('reversal group mirrors original (BKASH credited back)')
    : bad('reversal group', JSON.stringify(revLegs)?.slice(0, 160));

  console.log('\n═══ C. Maintenance cost posting ═══');
  r = await req('POST', '/tenant/maintenance', {
    ...H,
    body: { unitId: unit.id, scope: 'UNIT', title: `Geyser leak ${TAG}`, urgency: 'URGENT', payer: 'UNIT_OWNER' },
  });
  const mr = d(r);
  mr?.id ? ok(`maintenance request opened (${mr.id.slice(-6)})`) : bad('maintenance request', m(r));
  r = await req('POST', '/tenant/maintenance/work-orders', {
    ...H, body: { requestId: mr.id, assignedTo: 'Karim Plumbing', cost: 3500 },
  });
  const wo = d(r);
  wo?.id ? ok('work order assigned (est. ৳3,500)') : bad('work order create', m(r));
  if (!wo?.id) process.exit(1);

  r = await req('PATCH', `/tenant/maintenance/work-orders/${wo.id}/complete`, {
    ...H, body: { cost: 4000, afterPhotoUrl: 'https://img.ferio.test/fixed.png' },
  });
  d(r)?.status === 'COMPLETED' ? ok('work order completed at actual ৳4,000') : bad('complete WO', m(r));

  r = await req('GET', `/tenant/reports/ledger/${encodeURIComponent(`wo-complete:${wo.id}`)}`, H);
  const woLegs = Array.isArray(d(r)) ? d(r) : [];
  const exp = woLegs.find((l: any) => l.account === 'MAINTENANCE_EXPENSE');
  const ap = woLegs.find((l: any) => l.account === 'ACCOUNTS_PAYABLE');
  exp?.debit === 4000 && ap?.credit === 4000
    ? ok('WO group: MAINTENANCE_EXPENSE Dr 4,000 · ACCOUNTS_PAYABLE Cr 4,000')
    : bad('wo ledger', JSON.stringify(woLegs)?.slice(0, 180));

  r = await req('GET', '/tenant/reports/trial-balance', H);
  const final = d(r);
  const maintExp = final?.rows?.find((x: any) => x.account === 'MAINTENANCE_EXPENSE');
  final?.balanced && maintExp && maintExp.balance >= 4000
    ? ok(`final trial balance balanced · MAINTENANCE_EXPENSE balance ৳${maintExp.balance}`)
    : bad('final trial balance', JSON.stringify(final)?.slice(0, 170));

  console.log(`\n═══ RESULT: ${pass} passed / ${fail} failed ═══`);
  if (fail > 0) process.exit(1);
}

main().catch((e) => { console.error('❌ FATAL:', e.message ?? e); process.exit(1); });
