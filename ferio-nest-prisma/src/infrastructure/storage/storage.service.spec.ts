import { BadRequestException } from '@nestjs/common';
import { StorageService } from './storage.service';

describe('StorageService signed downloads', () => {
  const originalSigningSecret = process.env.STORAGE_SIGNING_SECRET;
  const originalDriver = process.env.STORAGE_DRIVER;

  beforeEach(() => {
    process.env.STORAGE_SIGNING_SECRET = 'test-storage-signing-secret';
    process.env.STORAGE_DRIVER = 'local';
  });

  afterEach(() => {
    if (originalSigningSecret === undefined) delete process.env.STORAGE_SIGNING_SECRET;
    else process.env.STORAGE_SIGNING_SECRET = originalSigningSecret;
    if (originalDriver === undefined) delete process.env.STORAGE_DRIVER;
    else process.env.STORAGE_DRIVER = originalDriver;
  });

  it('creates a short-lived URL whose key and expiry are tamper-evident', () => {
    const storage = new StorageService();
    const url = new URL(
      storage.createSignedDownloadUrl(
        'storage://documents/marketplace/user-1/2026/08/deed.pdf',
      ),
    );
    const key = url.searchParams.get('key')!;
    const expires = Number(url.searchParams.get('expires'));
    const signature = url.searchParams.get('signature')!;

    expect(() => storage.assertSignedDownload(key, expires, signature)).not.toThrow();
    expect(() =>
      storage.assertSignedDownload(`${key}.tampered`, expires, signature),
    ).toThrow(BadRequestException);
  });

  it('rejects expired links', () => {
    const storage = new StorageService();
    expect(() =>
      storage.assertSignedDownload('documents/a.pdf', 1, '00'),
    ).toThrow(/expired/i);
  });

  it('rejects managed references owned by another scope but permits legacy URLs', () => {
    const storage = new StorageService();
    const scope = { realm: 'organization' as const, id: 'org-1' };

    expect(() =>
      storage.assertReferenceScope(
        'storage://documents/organization/org-1/2026/08/lease.pdf',
        scope,
      ),
    ).not.toThrow();
    expect(() =>
      storage.assertReferenceScope(
        'storage://documents/organization/org-2/2026/08/lease.pdf',
        scope,
      ),
    ).toThrow(BadRequestException);
    expect(() => storage.assertReferenceScope('https://legacy.test/lease.pdf', scope)).not.toThrow();
  });
});
