/**
 * prog-35 verification — IAM delegation (grant → elevated write → expiry
 * → revoke), API key rotation, JSON data-portability export.
 */
const B = process.env.API_BASE ?? 'http://localhost:6799/api/v1';
let pass = 0, fail = 0;
const ok = (l: string) => { pass++; console.log(`  ✅ ${l}`); };
const bad = (l: string, d?: unknown) => { fail++; console.log(`  ❌ ${l}${d !== undefined ? ' → ' + String(d).slice(0, 170) : ''}`); };

async function req(method: string, path: string, o: { token?: string; slug?: string; key?: string; body?: unknown } = {}) {
  const res = await fetch(`${B}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(o.token ? { Authorization: `Bearer ${o.token}` } : {}),
      ...(o.key ? { Authorization: `Bearer ${o.key}` } : {}),
      ...(o.slug ? { 'X-Tenant-Slug': o.slug } : {}),
    },
    body: o.body === undefined ? undefined : JSON.stringify(o.body),
  });
  const ct = res.headers.get('content-type') ?? '';
  if (ct.includes('application/json')) {
    const json = await res.json().catch(() => ({}));
    return { status: res.status, ...json };
  }
  const text = await res.text();
  return { status: res.status, text, headers: Object.fromEntries(res.headers.entries()) };
}
const d = (r: any) => r?.data;
function m(r: any) { return r?.message ?? JSON.stringify(r)?.slice(0, 130); }
let r: any;
const TAG = Date.now();

async function main() {
  const owner = d(await req('POST', '/identity/login', { body: { email: 'owner@demo.test', password: 'supersecret1' } }));
  const H = { token: owner.token, slug: 'sheakh-fam' };

  console.log('\n═══ A. IAM delegation elevates a VIEWER temporarily ═══');

  // Create a fresh VIEWER member
  const vTok =
    d(await req('POST', '/identity/register', { body: { email: `del${TAG}@demo.test`, password: 'supersecret1', displayName: 'Dele Gate' } })) ||
    d(await req('POST', '/identity/login', { body: { email: `del${TAG}@demo.test`, password: 'supersecret1' } }));
  const viewerToken = vTok?.token;
  const viewerUid = d(await req('GET', '/identity/me', { token: viewerToken }))?.userId;

  // Owner invites + activates the viewer
  r = await req('POST', '/tenant/iam/invites', {
    ...H, body: { email: `del${TAG}@demo.test`, role: 'VIEWER' },
  });
  let invite = d(r);
  if (!invite?.token) {
    // maybe already a member from an earlier run — find them
    const members = d(await req('GET', '/tenant/iam/members', H)) ?? [];
    invite = { memberId: members.find((x: any) => x.centralUserId === viewerUid)?.id };
  }
  if (invite?.token) {
    r = await req('POST', `/tenant/iam/invites/accept`, {
      token: viewerToken, slug: 'sheakh-fam',
      body: { token: invite.token, displayName: 'Dele Gate' },
    });
    if (!d(r)?.member && !invite.memberId) {
      // accept may need different payload shape; fall back to direct member row via owner
      const members = d(await req('GET', '/tenant/iam/members', H)) ?? [];
      invite.memberId = members.find((x: any) => x.centralUserId === viewerUid)?.id;
    }
  }

  // Baseline: VIEWER cannot write billing
  const props = d(await req('GET', '/tenant/properties', H));
  const unit = d(await req('POST', '/tenant/units', {
    ...H, body: { propertyId: props[0].id, name: `DEL-${TAG}`, type: 'APARTMENT', floor: 8, bedrooms: 2, bathrooms: 2 },
  }));
  r = await req('POST', `/renter/../tenant/billing/invoices`.replace('/renter/..', ''), {
    token: viewerToken, slug: 'sheakh-fam',
    body: { unitId: unit.id, periodStart: '2026-11-01', periodEnd: '2026-11-30', dueDate: '2026-11-05' },
  });
  r.status === 403 ? ok('baseline: VIEWER billing write blocked (403)') : bad('baseline guard', `${r.status} ${m(r)}`);

  // Find viewer's memberId
  const members = d(await req('GET', '/tenant/iam/members', H)) ?? [];
  const viewerMember = members.find((x: any) => x.centralUserId === viewerUid);
  if (!viewerMember?.id) { bad('viewer member lookup', JSON.stringify(members)?.slice(0, 120)); process.exit(1); }

  // Non-owner cannot delegate
  r = await req('POST', '/tenant/iam/delegations', {
    token: viewerToken, slug: 'sheakh-fam',
    body: { toMemberId: viewerMember.id, domains: ['billing'] },
  });
  r.status === 403 ? ok('non-owner cannot delegate (403)') : bad('delegate guard', `${r.status}`);

  // Grant billing for 60 seconds
  const expiresAt = new Date(Date.now() + 10 * 60_000).toISOString();
  r = await req('POST', '/tenant/iam/delegations', {
    ...H, body: { toMemberId: viewerMember.id, domains: ['billing'], expiresAt },
  });
  const del = d(r);
  del?.id && del.domains.includes('billing') ? ok('owner granted billing delegation (10 min)') : bad('delegation create', m(r));

  // Elevated write now succeeds — seed charge first (owner), then viewer invoices
  await req('POST', '/tenant/billing/invoices', {
    ...H, body: { unitId: unit.id, periodStart: '2026-10-01', periodEnd: '2026-10-31', dueDate: '2026-10-05' },
  });
  const ba = d(await req('GET', `/tenant/billing/accounts?unitId=${unit.id}`, H));
  await req('POST', '/tenant/billing/charges', { ...H, body: { billingAccountId: ba.id, category: 'RENT', label: 'Rent', amount: 18000 } });
  r = await req('POST', '/tenant/billing/invoices', {
    token: viewerToken, slug: 'sheakh-fam',
    body: { unitId: unit.id, periodStart: '2026-11-01', periodEnd: '2026-11-30', dueDate: '2026-11-05' },
  });
  (r.status === 201 || r.status === 200)
    ? ok(`delegated billing write allowed (${String(d(r)?.invoiceNumber ?? '').slice(0, 16)})`)
    : bad('elevated write', `${r.status} ${m(r)}`);

  // Revoke → immediately blocked again
  r = await req('DELETE', `/tenant/iam/delegations/${del.id}`, H);
  d(r)?.deleted === true || r.status === 200 ? ok('owner revoked delegation') : bad('revoke', m(r));
  r = await req('POST', '/tenant/billing/invoices', {
    token: viewerToken, slug: 'sheakh-fam',
    body: { unitId: unit.id, periodStart: '2026-12-01', periodEnd: '2026-12-31', dueDate: '2026-12-05' },
  });
  r.status === 403 ? ok('post-revoke write blocked again (403)') : bad('post-revoke', `${r.status} ${m(r)}`);

  console.log('\n═══ B. API key rotation ═══');
  const staff = d(await req('POST', '/identity/platform/login', {
    body: { email: 'admin@ferio.test', password: 'RootAdmin1!' },
  }));
  const orgs = d(await req('GET', '/platform/organizations', { token: staff.token }));
  const orgId = (Array.isArray(orgs) ? orgs : []).find((o: any) => o.slug === 'sheakh-fam')?.id;

  r = await req('POST', `/platform/organizations/${orgId}/api-keys`, {
    token: staff.token, body: { name: `Rotate me ${TAG}`, scopes: ['units:read'] },
  });
  const k1 = d(r);
  r = await req('GET', '/external/v1/ping', { key: k1.key });
  d(r)?.pong ? ok('original key works') : bad('pre-rotate ping', m(r));

  r = await req('POST', `/platform/api-keys/${k1.id}/rotate`, { token: staff.token });
  const k2 = d(r);
  k2?.key?.startsWith('fk_live_') && k2.rotatedFrom === k1.id
    ? ok('rotation issued new secret (old revoked)')
    : bad('rotate', m(r));

  r = await req('GET', '/external/v1/ping', { key: k1.key });
  r.status === 401 ? ok('old key dead post-rotation (401)') : bad('old key', `${r.status}`);
  r = await req('GET', '/external/v1/ping', { key: k2.key });
  d(r)?.pong ? ok('new key live') : bad('new key', m(r));

  console.log('\n═══ C. Data-portability export (§ W36 close-out) ═══');
  const res = await fetch(`${B}/platform/organizations/${orgId}/export`, {
    headers: { Authorization: `Bearer ${staff.token}` },
  });
  const text = await res.text();
  let payload: any = null;
  try { payload = JSON.parse(text); } catch {}
  res.status === 200 &&
    payload?.format === 'ferio-export-v1' &&
    payload.counts.units >= 1 &&
    payload.data.properties &&
    payload.data.leases &&
    res.headers.get('content-disposition')?.includes('.json')
    ? ok(`export delivered (${payload.counts.units} units · ${payload.counts.invoices} invoices · disposition attachment)`)
    : bad('export', `status=${res.status} counts=${JSON.stringify(payload?.counts)} cd=${res.headers.get('content-disposition')}`);

  console.log(`\n═══ RESULT: ${pass} passed / ${fail} failed ═══`);
  if (fail > 0) process.exit(1);
}

main().catch((e) => { console.error('❌ FATAL:', e.message ?? e); process.exit(1); });
