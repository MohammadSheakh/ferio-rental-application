/**
 * prog-28 verification — §13 secure uploads: S3/local storage pipeline,
 * validation, static serving for local driver, registration into listings/rooms.
 */
const B = process.env.API_BASE ?? 'http://localhost:6799/api/v1';
let pass = 0, fail = 0;
const ok = (l: string) => { pass++; console.log(`  ✅ ${l}`); };
const bad = (l: string, d?: unknown) => { fail++; console.log(`  ❌ ${l}${d !== undefined ? ' → ' + String(d).slice(0, 160) : ''}`); };

const TAG = Date.now() % 100000;

/** 1×1 transparent PNG */
const PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const MIN_PDF = Buffer.from('%PDF-1.4\n%%EOF\n', 'utf8');

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
function m(r: any) { return r?.message ?? JSON.stringify(r)?.slice(0, 120); }
let r: any;

async function upload(path: string, token: string, buf: Buffer, mime: string, filename = 'file.bin', extraHeaders: Record<string, string> = {}) {
  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(buf)], { type: mime }), filename);
  const res = await fetch(`${B}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, ...extraHeaders },
    body: form,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, ...json };
}

async function main() {
  console.log('═══ A. Upload pipeline basics ═══');

  const user = d(await req('POST', '/identity/register', {
    body: { email: `uploader${TAG}@demo.test`, password: 'supersecret1', displayName: 'Upload U' },
  }));
  let token = user?.token;
  if (!token) {
    token = d(await req('POST', '/identity/login', { body: { email: `uploader${TAG}@demo.test`, password: 'supersecret1' } }))?.token;
  }

  // Anonymous blocked
  r = await fetch(`${B}/marketplace/uploads/images`, {
    method: 'POST',
    body: (() => { const f = new FormData(); f.append('file', new Blob([new Uint8Array(Buffer.from(PNG_B64, 'base64'))], { type: 'image/png' }), 'x.png'); return f; })(),
  });
  r.status === 401 ? ok('anonymous upload rejected (401)') : bad('anon upload', r.status);

  // Image upload
  r = await upload('/marketplace/uploads/images', token, Buffer.from(PNG_B64, 'base64'), 'image/png', 'one.png');
  const img = d(r);
  img?.url && r.status === 201 ? ok(`image uploaded → ${img.url.slice(-46)}`) : bad('image upload', m(r));

  // Served back correctly
  const head = await fetch(img.url);
  head.status === 200 && (head.headers.get('content-type') ?? '').includes('image/png')
    ? ok('uploaded image served back (200 · image/png)')
    : bad('fetch image', `${head.status} ${head.headers.get('content-type')}`);

  // Document upload
  r = await upload('/marketplace/uploads/documents', token, MIN_PDF, 'application/pdf', 'deed.pdf');
  const doc = d(r);
  doc?.url?.startsWith('storage://') && doc.contentType === 'application/pdf'
    ? ok('pdf document uploaded as an opaque private reference')
    : bad('doc upload', m(r));

  // Validation: wrong type
  r = await upload('/marketplace/uploads/images', token, Buffer.from('hello world'), 'text/plain', 'x.txt');
  r.status === 400 ? ok('wrong mime rejected (400)') : bad('mime guard', r.status);

  // Validation: oversized image (>5MB)
  r = await upload('/marketplace/uploads/images', token, Buffer.alloc(5 * 1024 * 1024 + 10, 7), 'image/png', 'big.png');
  [413, 400].includes(r.status) ? ok(`oversized image rejected (${r.status})`) : bad('size guard', r.status);

  console.log('\n═══ B. Uploads registered on listings & rooms ═══');

  await req('POST', '/marketplace/accounts', { token, body: { centralUserId: d(await req('GET', '/identity/me', { token }))?.userId, displayName: 'Upload U' } }).then(d);
  const acct = d(await req('GET', `/marketplace/accounts/me/${d(await req('GET', '/identity/me', { token }))?.userId}`, { token }));
  r = await req('POST', `/marketplace/accounts/${acct.id}/listings`, {
    token,
    body: {
      purpose: 'RENT', assetType: 'APARTMENT',
      title: `Uploaded Photos Flat ${TAG}`, price: 32000,
      area: 'Uttara', district: 'Dhaka', latitude: 23.8759, longitude: 90.3795,
    },
  });
  const listingId = d(r)?.id;
  const staff = d(await req('POST', '/identity/platform/login', { body: { email: 'admin@ferio.test', password: 'RootAdmin1!' } }));
  await req('POST', `/platform/marketplace/listings/${listingId}/approve`, { token: staff.token });

  r = await req('POST', `/marketplace/accounts/${acct.id}/listings/${listingId}/documents`, {
    token,
    body: { name: 'Deed', fileUrl: doc.url, docType: 'DEED', visibility: 'PUBLIC' },
  });
  d(r)?.id ? ok('private document reference registered by its owner') : bad('register document', m(r));
  const documentDetail = d(await req('GET', `/marketplace/listings/${listingId}`));
  const signedDocumentUrl = documentDetail?.documents?.[0]?.fileUrl;
  const docHead = await fetch(signedDocumentUrl);
  signedDocumentUrl?.startsWith('http') &&
  (docHead.headers.get('content-type') ?? '').includes('application/pdf')
    ? ok('authorized metadata returns a signed PDF download URL')
    : bad('fetch signed document', docHead.status);

  r = await req('POST', `/marketplace/accounts/${acct.id}/listings/${listingId}/media`, {
    token, body: { url: img.url, isCover: true },
  });
  d(r)?.id ? ok('uploaded image registered as listing cover') : bad('register media', m(r));

  r = await req('POST', `/marketplace/accounts/${acct.id}/listings/${listingId}/rooms`, {
    token,
    body: {
      name: 'Bedroom 2', type: 'BEDROOM', lengthFt: 11, widthFt: 10,
      media: [{ url: img.url, caption: 'from pipeline' }],
    },
  });
  d(r)?.id ? ok('room created with pipeline-uploaded photo') : bad('room w/ upload', m(r));

  r = await req('GET', `/marketplace/listings/${listingId}`);
  const det = d(r);
  det?.media?.[0]?.url === img.url &&
  det?.media?.[0]?.isCover === true &&
  det?.rooms?.[0]?.media?.[0]?.url === img.url
    ? ok('public detail serves pipeline URLs (media + room)')
    : bad('detail urls', JSON.stringify({ m: det?.media?.[0]?.url, rm: det?.rooms?.[0]?.media?.[0]?.url })?.slice(0, 140));

  console.log('\n═══ C. Tenant-plane upload ═══');
  const owner = d(await req('POST', '/identity/login', { body: { email: 'owner@demo.test', password: 'supersecret1' } }));
  r = await upload('/tenant/uploads/images', owner.token, Buffer.from(PNG_B64, 'base64'), 'image/png', 'meter.png', { 'X-Tenant-Slug': 'sheakh-fam' });
  d(r)?.url ? ok('tenant member uploads meter/maintenance photo') : bad('tenant upload', m(r));

  console.log(`\n═══ RESULT: ${pass} passed / ${fail} failed ═══`);
  if (fail > 0) process.exit(1);
}

main().catch((e) => { console.error('❌ FATAL:', e.message ?? e); process.exit(1); });
