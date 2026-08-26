import {
  Injectable,
  BadRequestException,
  PayloadTooLargeException,
  Logger,
} from '@nestjs/common';
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

/** kind → allowed mime types. Anything else is rejected at the door. */
const ALLOWED_MIME: Record<'images' | 'documents', string[]> = {
  images: ['image/jpeg', 'image/png', 'image/webp'],
  documents: ['application/pdf', 'image/jpeg', 'image/png'],
};

const MAX_BYTES: Record<'images' | 'documents', number> = {
  images: 5 * 1024 * 1024,
  documents: 10 * 1024 * 1024,
};

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

export interface StorageScope {
  realm: 'marketplace' | 'organization';
  id: string;
}

/**
 * Ferio Storage — file upload pipeline (§13 secure uploads).
 *
 * Two interchangeable drivers behind one contract:
 * - 's3'    → any S3-compatible object store (AWS S3, MinIO, Spaces, R2)
 *             configured purely through env vars.
 * - 'local' → disk-backed fallback for development/scratch environments.
 *
 * Upload endpoints hand us an in-memory multer buffer; we validate,
 * derive a content-addressed-style key, persist, and return a stable
 * public image URL or opaque private document reference that callers register.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly driver: 's3' | 'local';
  private s3?: S3Client;

  constructor() {
    this.driver =
      process.env.STORAGE_DRIVER === 's3' ? 's3' : 'local';
    if (this.driver === 's3') this.initS3();
    else this.logger.log(
      `💾 Storage: LOCAL driver (${this.localDir()}), public base ${this.publicBase()}`,
    );
  }

  private initS3() {
    const bucket = process.env.S3_BUCKET;
    const region = process.env.S3_REGION;
    const accessKeyId = process.env.S3_ACCESS_KEY_ID;
    const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
    if (!bucket || !region || !accessKeyId || !secretAccessKey) {
      throw new Error(
        'STORAGE_DRIVER=s3 requires S3_BUCKET, S3_REGION, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY',
      );
    }
    const endpoint = process.env.S3_ENDPOINT; // optional: MinIO / R2 / Spaces
    this.s3 = new S3Client({
      region,
      ...(endpoint ? { endpoint, forcePathStyle: true } : {}),
      credentials: { accessKeyId, secretAccessKey },
    });
    this.logger.log(
      `💾 Storage: S3 driver → bucket "${bucket}"${endpoint ? ` @ ${endpoint}` : ''}`,
    );
  }

  async upload(
    kind: 'images' | 'documents',
    file: { buffer: Buffer; mimetype?: string; originalname?: string; size?: number },
    scope?: StorageScope,
  ): Promise<{ url: string; key: string; contentType: string; size: number }> {
    const contentType = file.mimetype ?? '';
    if (!ALLOWED_MIME[kind].includes(contentType)) {
      throw new BadRequestException(
        `File type not allowed for ${kind}. Accepted: ${ALLOWED_MIME[kind].join(', ')}`,
      );
    }
    const maxBytes = MAX_BYTES[kind];
    const size = file.size ?? file.buffer.byteLength;
    if (size <= 0) throw new BadRequestException('Empty file');
    if (size > maxBytes) {
      throw new PayloadTooLargeException(
        `File exceeds ${Math.round(maxBytes / 1024 / 1024)}MB limit`,
      );
    }

    const ext = EXT_BY_MIME[contentType] ?? 'bin';
    const now = new Date();
    const yyyyMm = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
    if (kind === 'documents' && (!scope?.id || !/^[a-zA-Z0-9_-]+$/.test(scope.id))) {
      throw new BadRequestException('Private document uploads require a valid owner scope');
    }
    const scopePath = scope ? `${scope.realm}/${scope.id}/` : '';
    const key = `${kind}/${scopePath}${yyyyMm}/${Date.now().toString(36)}-${randomBytes(8).toString('hex')}.${ext}`;

    const url =
      kind === 'images'
        ? this.driver === 's3'
          ? await this.putS3Public(key, file.buffer, contentType)
          : await this.putLocalPublic(key, file.buffer)
        : await this.putPrivate(key, file.buffer, contentType);

    return { url, key, contentType, size };
  }

  private async writeS3(key: string, body: Buffer, contentType: string): Promise<void> {
    const bucket = process.env.S3_BUCKET!;
    await this.s3!.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }));
  }

  private async putS3Public(key: string, body: Buffer, contentType: string): Promise<string> {
    await this.writeS3(key, body, contentType);
    const bucket = process.env.S3_BUCKET!;
    const publicBase = process.env.S3_PUBLIC_BASE_URL;
    if (publicBase) return `${publicBase.replace(/\/$/, '')}/${key}`;
    const endpoint = process.env.S3_ENDPOINT;
    if (endpoint) return `${endpoint.replace(/\/$/, '')}/${bucket}/${key}`;
    return `https://${bucket}.s3.${process.env.S3_REGION}.amazonaws.com/${key}`;
  }

  /** § Week 36 — arbitrary binary objects (e.g. tenant DB backups). */
  async putRawObject(key: string, body: Buffer): Promise<string> {
    await this.putPrivate(key, body, 'application/octet-stream');
    return this.storageReference(key);
  }

  async getRawObject(key: string): Promise<Buffer> {
    this.assertSafeKey(key);
    if (this.driver === 's3') {
      const { GetObjectCommand } = await import('@aws-sdk/client-s3');
      const res = await this.s3!.send(
        new GetObjectCommand({ Bucket: process.env.S3_BUCKET!, Key: key }),
      );
      const bytes = await res.Body?.transformToByteArray();
      return Buffer.from(bytes ?? []);
    }
    return readFile(join(this.localDir(), ...key.split('/')));
  }

  private async putPrivate(key: string, body: Buffer, contentType: string): Promise<string> {
    if (this.driver === 's3') await this.writeS3(key, body, contentType);
    else await this.writeLocal(key, body);
    return this.storageReference(key);
  }

  private async putLocalPublic(key: string, body: Buffer): Promise<string> {
    await this.writeLocal(key, body);
    return `${this.publicBase()}/uploads/${key}`;
  }

  private async writeLocal(key: string, body: Buffer): Promise<void> {
    const dir = join(this.localDir(), ...key.split('/').slice(0, -1));
    await mkdir(dir, { recursive: true });
    await writeFile(join(this.localDir(), ...key.split('/')), body);
  }

  isManagedReference(value: string): boolean {
    return value.startsWith('storage://');
  }

  assertReferenceScope(reference: string, scope: StorageScope): void {
    if (!this.isManagedReference(reference)) return;
    const key = this.keyFromReference(reference);
    const expectedPrefix = `documents/${scope.realm}/${scope.id}/`;
    if (!key.startsWith(expectedPrefix)) {
      throw new BadRequestException('Document reference does not belong to this owner');
    }
  }

  createSignedDownloadUrl(reference: string, ttlSeconds = 300): string {
    if (!this.isManagedReference(reference)) return reference;
    const key = this.keyFromReference(reference);
    const expires = Math.floor(Date.now() / 1000) + Math.max(30, ttlSeconds);
    const signature = this.sign(key, expires);
    const query = new URLSearchParams({ key, expires: String(expires), signature });
    const apiPrefix = (process.env.API_PREFIX || 'api/v1').replace(/^\/+|\/+$/g, '');
    return `${this.publicBase()}/${apiPrefix}/storage/objects?${query.toString()}`;
  }

  assertSignedDownload(key: string, expires: number, signature: string): void {
    this.assertSafeKey(key);
    if (!Number.isInteger(expires) || expires < Math.floor(Date.now() / 1000)) {
      throw new BadRequestException('Download link has expired');
    }
    const expected = Buffer.from(this.sign(key, expires), 'hex');
    const actual = Buffer.from(signature || '', 'hex');
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
      throw new BadRequestException('Invalid download signature');
    }
  }

  private storageReference(key: string): string {
    this.assertSafeKey(key);
    return `storage://${key}`;
  }

  private keyFromReference(reference: string): string {
    const key = reference.slice('storage://'.length);
    this.assertSafeKey(key);
    return key;
  }

  private assertSafeKey(key: string): void {
    if (!key || key.startsWith('/') || key.includes('..') || key.includes('\\')) {
      throw new BadRequestException('Invalid storage key');
    }
  }

  private sign(key: string, expires: number): string {
    const secret = process.env.STORAGE_SIGNING_SECRET || process.env.JWT_ACCESS_SECRET;
    if (!secret) throw new Error('STORAGE_SIGNING_SECRET or JWT_ACCESS_SECRET is required');
    return createHmac('sha256', secret).update(`${key}:${expires}`).digest('hex');
  }

  private localDir(): string {
    return process.env.STORAGE_LOCAL_DIR ?? join(process.cwd(), 'storage-uploads');
  }

  /** Absolute base used when building public URLs for locally-stored files. */
  private publicBase(): string {
    return (
      process.env.STORAGE_PUBLIC_URL ??
      `http://localhost:${process.env.PORT ?? 6733}`
    );
  }
}
