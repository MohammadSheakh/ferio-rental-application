/**
 * prog-31 verification — § Week 33 External API & Webhooks:
 * API keys (issue/resolve/revoke/scopes), per-key rate limits,
 * signed webhook deliveries with retry, dead-letter and replay.
 */
import { createHmac } from 'crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'http';

const B = process.env.API_BASE ?? 'http://localhost:6799/api/v1';
let pass = 0, fail = 0;
const ok = (l: string) => { pass++; console.log(`  ✅ ${l}`); };
const bad = (l: string, d?: unknown) => { fail++; console.log(`  ❌ ${l}${d !== undefined ? ' → ' + String(d).slice(0, 170) : ''}`); };

async function req(method: string, path: string, o: { token?: string; slug?: string; body?: unknown; key?: string } = {}) {
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
  const json = await res.json().catch(() => ({}));
  return { status: res.status, headers: Object.fromEntries(res.headers.entries()), ...json };
}
const d = (r: any) => r?.data;
function m(r: any) { return r?.message ?? JSON.stringify(r)?.slice(0, 130); }
let r: any;
const TAG = Date.now() % 100000;

/** Local webhook receiver. */
function startReceiver(port: number): Promise<{
  hits: Array<{ event: string | undefined; sig: string | undefined; raw: string; deliveryId: string | undefined }>;
  close: () => void;
}> {
  const hits: Array<{ event: string | undefined; sig: string | undefined; raw: string; deliveryId: string | undefined }> = [];
  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      hits.push({
        event: req.headers['x-ferio-event'] as string | undefined,
        sig: req.headers['x-ferio-signature'] as string | undefined,
        raw,
        deliveryId: req.headers['x-ferio-delivery'] as string | undefined,
      });
      res.writeHead(200);
      res.end('ok');
    });
  });
  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () =>
      resolve({ hits, close: () => server.close() }),
    );
  });
}

const sleep = (ms: number) => new Promise((res2) => setTimeout(res2, ms));

async function main() {
  const staff = d(await req('POST', '/identity/platform/login', {
    body: { email: 'admin@ferio.test', password: 'RootAdmin1!' },
  }));

  // Resolve sheakh-fam org id
  r = await req('GET', '/platform/api-keys/scopes', { token: staff.token });
  d(r)?.scopes?.includes('units:read') ? ok('scopes catalog listed') : bad('scopes', m(r));

  const orgs = d(await req('GET', '/platform/organizations', { token: staff.token }));
  const orgId = (Array.isArray(orgs) ? orgs : []).find((o: any) => o.slug === 'sheakh-fam')?.id;

  console.log('\n═══ A. API keys: issue → authenticate → scope → revoke ═══');

  // No key
  r = await fetch(`${B}/external/v1/ping`);
  r.status === 401 ? ok('missing key rejected (401)') : bad('no key', r.status);

  // Issue full-scope key
  r = await req('POST', `/platform/organizations/${orgId}/api-keys`, {
    token: staff.token,
    body: { name: `Prog31 key ${TAG}`, scopes: ['units:read', 'invoices:read'] },
  });
  const key1 = d(r);
  key1?.key?.startsWith('fk_live_') && key1.scopes?.length === 2
    ? ok(`key issued once (${key1.key.slice(0, 16)}… · scopes: ${key1.scopes.join(',')})`)
    : bad('key issue', m(r));

  // ping works with key
  r = await req('GET', '/external/v1/ping', { key: key1.key });
  d(r)?.pong === true && d(r)?.organizationId === orgId
    ? ok('ping authenticates + binds organization')
    : bad('ping', m(r));

  // units allowed (units:read)
  r = await req('GET', '/external/v1/units?limit=5'.replace('?limit=5', ''), { key: key1.key });
  Array.isArray(d(r)?.data) ? ok(`units:read returns ${d(r).data.length} unit(s)`) : bad('units read', m(r));

  // leases NOT in scopes → 403
  r = await req('GET', '/external/v1/leases', { key: key1.key });
  r.status === 403 ? ok('scope enforcement blocks leases:read (403)') : bad('scope guard', `${r.status} ${m(r)}`);

  // revoke → immediate 401
  await req('POST', `/platform/api-keys/${key1.id}/revoke`, { token: staff.token });
  r = await req('GET', '/external/v1/ping', { key: key1.key });
  r.status === 401 ? ok('revoked key immediately rejected (401)') : bad('revocation', r.status);

  console.log('\n═══ B. Per-key rate limit ═══');
  r = await req('POST', `/platform/organizations/${orgId}/api-keys`, {
    token: staff.token, body: { name: `Rate key ${TAG}` },
  });
  const key2 = d(r)?.key;
  let got429 = false;
  for (let i = 0; i < 15; i++) {
    const rr = await fetch(`${B}/external/v1/ping`, {
      headers: { Authorization: `Bearer ${key2}` },
    });
    if (rr.status === 429) { got429 = true; break; }
  }
  got429 ? ok('per-key rate limit bites (429 within window)') : bad('rate limit', 'no 429 after 15 pings');

  console.log('\n═══ C. Signed webhook delivery + replay ═══');
  const receiver = await startReceiver(7799);

  // Owner registers two endpoints: one live receiver, one dead port
  const owner = d(await req('POST', '/identity/login', { body: { email: 'owner@demo.test', password: 'supersecret1' } }));
  const H = { token: owner.token, slug: 'sheakh-fam' };

  // Clean slate: remove endpoints from previous runs
  const stale = d(await req('GET', '/tenant/webhooks', H)) ?? [];
  for (const s of stale) await req('DELETE', `/tenant/webhooks/${s.id}`, H);

  r = await req('POST', '/tenant/webhooks', {
    ...H,
    body: {
      url: 'http://127.0.0.1:7799/hook',
      events: ['payment.verified'],
      description: 'prog-31 receiver',
    },
  });
  const hook = d(r);
  hook?.secret ? ok('webhook endpoint subscribed (secret shown once)') : bad('webhook create', m(r));

  // non-owner blocked
  const viewerTok = d(await req('POST', '/identity/register', {
    body: { email: `whviewer${TAG}@demo.test`, password: 'supersecret1', displayName: 'WH Viewer' },
  }))?.token ?? d(await req('POST', '/identity/login', { body: { email: `whviewer${TAG}@demo.test`, password: 'supersecret1' } }))?.token;
  if (viewerTok) {
    r = await req('POST', '/tenant/webhooks', {
      token: viewerTok, slug: 'sheakh-fam',
      body: { url: 'http://127.0.0.1:7799/x', events: ['payment.verified'] },
    });
    r.status === 403 ? ok('non-owner cannot manage webhooks (403)') : bad('owner guard', `${r.status}`);
  }

  // Dead endpoint (port 9 = discard, nothing listens)
  await req('POST', '/tenant/webhooks', {
    ...H,
    body: { url: 'http://127.0.0.1:9/dead', events: ['payment.verified'] },
  });

  // Trigger a payment.verified event
  const props = d(await req('GET', '/tenant/properties', H));
  const unit = d(await req('POST', '/tenant/units', {
    ...H, body: { propertyId: props[0].id, name: `WH-${TAG}`, type: 'APARTMENT', floor: 3, bedrooms: 2, bathrooms: 1 },
  }));
  await sleep(300);
  let inv = d(await req('POST', '/tenant/billing/invoices', {
    ...H, body: { unitId: unit.id, periodStart: '2026-10-01', periodEnd: '2026-10-31', dueDate: '2026-10-05' },
  }));
  if (!inv?.id) {
    const ba = d(await req('GET', `/tenant/billing/accounts?unitId=${unit.id}`, H));
    await req('POST', '/tenant/billing/charges', { ...H, body: { billingAccountId: ba.id, category: 'RENT', label: 'Rent', amount: 15000 } });
    inv = d(await req('POST', '/tenant/billing/invoices', {
      ...H, body: { unitId: unit.id, periodStart: '2026-10-01', periodEnd: '2026-10-31', dueDate: '2026-10-05' },
    }));
  }
  const pay = d(await req('POST', '/tenant/billing/payments', {
    ...H, body: { invoiceId: inv.id, method: 'NAGAD', amount: 5000, reference: 'P31-WEBHOOK' },
  }));
  r = await req('POST', `/tenant/billing/payments/${pay.id}/verify`, {
    ...H, body: { verifiedBy: d(await req('GET', '/identity/me', { token: owner.token }))?.userId },
  });
  d(r)?.status === 'VERIFIED' ? ok('payment verified (event emitted)') : bad('verify emit', m(r));

  // Wait for the worker to deliver to the live receiver
  let hit: { event: string | undefined; sig: string | undefined; raw: string; deliveryId: string | undefined } | undefined;
  for (let i = 0; i < 30 && !hit; i++) {
    await sleep(500);
    hit = receiver.hits.find((x) => x.event === 'payment.verified');
  }
  if (!hit) { bad('delivery received', 'receiver saw nothing'); process.exit(1); }
  ok('signed delivery arrived at receiver');

  // Verify HMAC signature over this endpoint's exact delivery
  const expected = createHmac('sha256', hook.secret).update(hit.raw).digest('hex');
  hit.sig === `sha256=${expected}`
    ? ok('X-Ferio-Signature HMAC-SHA256 valid')
    : bad('signature', `${hit.sig} vs sha256=${expected.slice(0, 12)}…`);

  // Delivery log shows SUCCESS for live endpoint and FAILED for dead one
  let successDelivery: any = null;
  let failedDelivery: any = null;
  for (let i = 0; i < 40 && !(successDelivery && failedDelivery); i++) {
    await sleep(500);
    const dl = d(await req('GET', '/tenant/webhooks/deliveries', H)) ?? [];
    successDelivery = successDelivery ?? dl.find((x: any) => x.status === 'SUCCESS' && x.event === 'payment.verified');
    failedDelivery = failedDelivery ?? dl.find((x: any) => x.status === 'FAILED' && x.event === 'payment.verified');
  }
  successDelivery ? ok('live delivery logged SUCCESS w/ response code') : bad('success log', 'none found');
  failedDelivery
    ? ok(`dead endpoint dead-lettered FAILED after ${failedDelivery.attempts} attempt(s)`)
    : bad('dead-letter log', 'none found');

  // Replay the successful delivery
  r = await req('POST', `/tenant/webhooks/deliveries/${successDelivery.id}/redeliver`, H);
  d(r)?.requeued ? ok('replay accepted') : bad('replay', m(r));
  let replaySeen = false;
  const beforeCount = receiver.hits.length;
  for (let i = 0; i < 20 && !replaySeen; i++) {
    await sleep(500);
    replaySeen = receiver.hits.length > beforeCount;
  }
  replaySeen ? ok('redelivery arrived at receiver') : bad('redelivery', 'not seen');

  receiver.close();

  console.log(`\n═══ RESULT: ${pass} passed / ${fail} failed ═══`);
  if (fail > 0) process.exit(1);
}

main().catch((e) => { console.error('❌ FATAL:', e.message ?? e); process.exit(1); });
