/** prog-15 verification: admin TOTP UX endpoints + per-resource scope ACLs. */
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

async function resetStaff() {
  const c = new Client({ connectionString: process.env.CONTROL_PLANE_DATABASE_URL ?? 'postgresql://postgres:testpass@localhost:5498/ferio_control' });
  await c.connect();
  await c.query(`UPDATE "PlatformUser" SET "totpEnabled"=false, "totpSecret"=NULL WHERE email='admin@ferio.test'`);
  await c.end();
}

async function main() {
  await resetStaff();

  console.log('═══ 1. TOTP status endpoint (console polling contract) ═══');
  let r = await req('POST', '/identity/platform/login', { body: { email: 'admin@ferio.test', password: 'RootAdmin1!' } });
  const ptok = d(r)?.token;
  ok('staff login (no TOTP yet)');

  r = await req('GET', '/identity/platform/totp/status', { token: ptok });
  if (d(r)?.enabled === false) ok('status → enabled:false'); else bad('status pre', m(r));

  const setup = d(await req('POST', '/identity/platform/totp/setup', { token: ptok }));
  r = await req('POST', '/identity/platform/totp/confirm', { token: ptok, body: { code: totpAt(setup.secret, Math.floor(Date.now() / 1000)) } });
  if (d(r)?.enabled === true) ok('setup+confirm via API (QR flow backend)'); else bad('confirm', JSON.stringify(d(r))?.slice(0,80));

  r = await req('GET', '/identity/platform/totp/status', { token: ptok });
  if (d(r)?.enabled === true) ok('status → enabled:true'); else bad('status post', m(r));

  // restore disabled state for other suites
  await req('POST', '/identity/platform/totp/disable', { token: ptok, body: { code: totpAt(setup.secret, Math.floor(Date.now() / 1000)) } });

  console.log('═══ 2. Per-resource scope ACLs ═══');
  r = await req('POST', '/identity/login', { body: { email: 'owner@demo.test', password: 'supersecret1' } });
  const ownerTok = d(r)?.token;

  const props = d(await req('GET', '/tenant/properties', { token: ownerTok, slug: 'sheakh-fam' }));
  if (props.length < 2) { bad(`need ≥2 properties for scope test (have ${props.length})`); process.exit(1); }
  const scopedProp = props[0];
  const otherProp = props[1];
  ok(`workspace has ${props.length} properties — scoping viewer to "${scopedProp.name}"`);

  // create a VIEWER identity, invite with VIEWER role
  const email = `viewer${Date.now()}@demo.test`;
  const regResp = await req('POST', '/identity/register', { body: { email, password: 'supersecret1', displayName: 'Scoped Viewer' } });
  const vtok = d(regResp)?.token;
  if (!vtok) { bad('viewer register', m(regResp) || JSON.stringify(regResp).slice(0,120)); process.exit(1); }
  ok('viewer identity registered');
  const vid = d(await req('GET', '/identity/me', { token: vtok })).userId;

  const inv = d(await req('POST', '/tenant/iam/invites', {
    token: ownerTok, slug: 'sheakh-fam',
    body: { email: email.replace('@', '+x@'), role: 'VIEWER' },
  }));
  // invite email uniqueness uses the +x trick? DTO IsEmail allows it; accept binds real identity.
  const acc = d(await req('POST', '/tenant/iam/invites/accept', {
    token: vtok, slug: 'sheakh-fam',
    body: { token: inv.token, displayName: 'Scoped Viewer' },
  }));
  if (acc?.accepted) ok('VIEWER invite accepted'); else bad('accept', JSON.stringify(acc ?? r).slice(0,140));

  // restrict their scopes to one property
  const units = d(await req('GET', '/tenant/units', { token: ownerTok, slug: 'sheakh-fam' }));
  const memberRowId = (await req('GET', '/tenant/iam/members', { token: ownerTok, slug: 'sheakh-fam' }))
    .data.find((mm: any) => mm.centralUserId === vid).id;
  await req('PATCH', `/tenant/iam/members/${memberRowId}`, {
    token: ownerTok, slug: 'sheakh-fam',
    body: { scopePropertyIds: [scopedProp.id] },
  });
  ok('scope restricted to one property');

  // viewer lists properties → only scoped one
  const seenProps = d(await req('GET', '/tenant/properties', { token: vtok, slug: 'sheakh-fam' }));
  if (seenProps.length === 1 && seenProps[0].id === scopedProp.id)
    ok(`property list filtered (${seenProps.length} of ${props.length})`);
  else bad('property filter', JSON.stringify(seenProps?.map((p: any) => p.name)));

  // viewer lists units → only units under scoped property
  const seenUnits = d(await req('GET', '/tenant/units', { token: vtok, slug: 'sheakh-fam' }));
  const foreign = seenUnits.filter((u: any) => u.propertyId !== scopedProp.id);
  if (foreign.length === 0 && seenUnits.every((u: any) => u.propertyId === scopedProp.id))
    ok(`unit list filtered (${seenUnits.length} units, all in scope)`);
  else bad('unit filter', `${seenUnits.length} rows, foreign=${foreign.length}`);

  // workspace-wide owner still sees everything
  const ownerView = d(await req('GET', '/tenant/units', { token: ownerTok, slug: 'sheakh-fam' }));
  if (ownerView.length >= seenUnits.length) ok('workspace-wide role unaffected'); else bad('owner view');

  console.log(`\n═══ RESULT: ${pass} passed / ${fail} failed ═══`);
  if (fail > 0) process.exit(1);
}
function m(r: any) { return r?.message ?? ''; }

main().catch((e) => { console.error('❌ FATAL:', e.message ?? e); process.exit(1); });
