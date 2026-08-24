/**
 * prog-34 verification — § Week 36 Tenant DB Operations:
 * pg_dump backup → verify → clone-to-staging → archive/unarchive lockout + metrics.
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

async function main() {
  const staff = d(await req('POST', '/identity/platform/login', {
    body: { email: 'admin@ferio.test', password: 'RootAdmin1!' },
  }));
  if (!staff?.token) { bad('staff login', m(staff)); process.exit(1); }

  const orgs = d(await req('GET', '/platform/organizations', { token: staff.token }));
  const sheakh = (Array.isArray(orgs) ? orgs : []).find((o: any) => o.slug === 'sheakh-fam');
  if (!sheakh?.id) { bad('org lookup', 'sheakh-fam missing'); process.exit(1); }

  console.log('\n═══ A. Physical backup (pg_dump -Fc → storage) ═══');
  r = await req('POST', `/platform/organizations/${sheakh.id}/backups`, {
    token: staff.token,
    body: { type: 'MANUAL', note: 'prog-34 session backup' },
  });
  const bak = d(r);
  bak?.status === 'COMPLETED' && Number(bak.sizeBytes) > 1000 && bak.tableCount >= 10
    ? ok(`backup taken (${bak.tableCount} tables · ${(Number(bak.sizeBytes) / 1024).toFixed(1)}KB)`)
    : bad('create backup', m(r));

  console.log('\n═══ B. Readability verification ═══');
  r = await req('POST', `/platform/backups/${bak.id}/verify`, { token: staff.token });
  d(r)?.readable === true && d(r)?.tableEntries >= 5
    ? ok(`pg_restore --list OK (${d(r).tableEntries} table entries in archive)`)
    : bad('verify', m(r));

  console.log('\n═══ C. Clone-to-staging ═══');
  r = await req('POST', `/platform/backups/${bak.id}/clone`, { token: staff.token });
  const clone = d(r);
  clone?.cloneName && clone.tableCount >= 5
    ? ok(`standalone clone restored (${clone.cloneName} · ${clone.tableCount} tables)`)
    : bad('clone', m(r));

  console.log('\n═══ D. Archive lockout + unarchive ═══');
  // Owner-side tenant call works before archiving
  const owner = d(await req('POST', '/identity/login', { body: { email: 'owner@demo.test', password: 'supersecret1' } }));
  r = await req('GET', '/tenant/utilities', { token: owner.token, slug: 'sheakh-fam' });
  r.status === 200 ? ok('tenant route healthy pre-archive') : bad('pre-archive health', `${r.status}`);

  r = await req('POST', `/platform/organizations/${sheakh.id}/archive`, { token: staff.token });
  d(r)?.databaseStatus === 'DISABLED' ? ok('archived → database DISABLED') : bad('archive', m(r));

  r = await req('GET', '/tenant/utilities', { token: owner.token, slug: 'sheakh-fam' });
  [503, 404].includes(r.status)
    ? ok(`resolver locks out archived workspace (${r.status})`)
    : bad('lockout', `${r.status} ${m(r)}`);

  r = await req('POST', `/platform/organizations/${sheakh.id}/unarchive`, { token: staff.token });
  d(r)?.databaseStatus === 'READY' ? ok('unarchived → READY again') : bad('unarchive', m(r));

  await sleep(1200);
  r = await req('GET', '/tenant/utilities', { token: owner.token, slug: 'sheakh-fam' });
  r.status === 200 ? ok('workspace fully served after unarchive') : bad('post-unarchive', `${r.status} ${m(r)}`);

  console.log('\n═══ E. Metrics + backup listing ═══');
  r = await req('GET', '/platform/backups?organizationId=' + sheakh.id, { token: staff.token });
  const list = Array.isArray(d(r)) ? d(r) : [];
  list.length >= 1 && list[0].verifiedAt ? ok(`backups listed w/ verifiedAt (${list.length})`) : bad('listing', m(r));

  r = await req('GET', '/platform/tenant-db/metrics', { token: staff.token });
  const met = d(r);
  met?.pooledConnections && met.databasesByStatus && met.backups?.total >= 1
    ? ok(`metrics live (pool=${JSON.stringify(met.pooledConnections)} · backups total ${met.backups.total})`)
    : bad('metrics', JSON.stringify(met)?.slice(0, 150));

  console.log(`\n═══ RESULT: ${pass} passed / ${fail} failed ═══`);
  if (fail > 0) process.exit(1);
}
function sleep(ms: number) { return new Promise((r4) => setTimeout(r4, ms)); }

main().catch((e) => { console.error('❌ FATAL:', e.message ?? e); process.exit(1); });
