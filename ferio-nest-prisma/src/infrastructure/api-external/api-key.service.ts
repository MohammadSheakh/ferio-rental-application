import { randomBytes, createHash } from 'crypto';
import { Injectable } from '@nestjs/common';
import { ControlPlanePrismaService } from '../control-plane/control-plane-prisma.service';

export const API_SCOPES = [
  'units:read',
  'invoices:read',
  'leases:read',
  'maintenance:read',
] as const;

export interface ResolvedApiKey {
  clientId: string;
  organizationId: string;
  scopes: string[];
}

/**
 * § Week 33 External API — machine credentials.
 * Key format: fk_live_<prefix>_<secret>. Only the sha256 hash of the
 * full key is stored; the complete key is returned exactly once at
 * creation.
 */
@Injectable()
export class ApiKeyService {
  constructor(private readonly controlPlane: ControlPlanePrismaService) {}

  async createKey(
    organizationId: string,
    input: { name: string; scopes?: string[]; createdBy?: string },
  ): Promise<{ id: string; name: string; scopes: string[]; key: string; keyPrefix: string }> {
    const valid = new Set<string>(API_SCOPES);
    const unknown = (input.scopes ?? []).filter((s) => !valid.has(s));
    if (unknown.length) {
      throw new Error(`Unknown scopes: ${unknown.join(', ')}`);
    }

    const prefix = randomBytes(4).toString('hex'); // 8 chars
    const secret = randomBytes(24).toString('base64url');
    const fullKey = `fk_live_${prefix}_${secret}`;
    const keyHash = sha256(fullKey);

    const row = await this.controlPlane.apiClient.create({
      data: {
        organizationId,
        name: input.name,
        keyPrefix: prefix,
        keyHash,
        scopes: input.scopes?.length ? input.scopes : [...API_SCOPES],
        createdBy: input.createdBy ?? null,
      },
    });

    return { id: row.id, name: row.name, scopes: row.scopes, key: fullKey, keyPrefix: prefix };
  }

  /** Resolve a bearer key to its client + org. Updates lastUsedAt best-effort. */
  async resolve(bearerToken: string): Promise<ResolvedApiKey | null> {
    if (!bearerToken.startsWith('fk_live_')) return null;
    const keyHash = sha256(bearerToken);
    const row = await this.controlPlane.apiClient.findUnique({
      where: { keyHash },
    });
    if (!row || row.status !== 'ACTIVE') return null;
    void this.controlPlane.apiClient
      .update({ where: { id: row.id }, data: { lastUsedAt: new Date() } })
      .catch(() => {});
    return { clientId: row.id, organizationId: row.organizationId, scopes: row.scopes };
  }

  async listKeys(organizationId?: string) {
    return this.controlPlane.apiClient.findMany({
      where: organizationId ? { organizationId } : undefined,
      include: { organization: { select: { slug: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  /**
   * § Week 33 rotation — issue a fresh secret for the same client
   * (name/scopes/org preserved), revoke the old credential atomically.
   * The new full key is returned exactly once.
   */
  async rotate(keyId: string, staffId?: string) {
    const existing = await this.controlPlane.apiClient.findUnique({
      where: { id: keyId },
    });
    if (!existing) throw new Error('API key not found');

    const prefix = randomBytes(4).toString('hex');
    const secret = randomBytes(24).toString('base64url');
    const fullKey = `fk_live_${prefix}_${secret}`;

    const [created] = await this.controlPlane.$transaction([
      this.controlPlane.apiClient.create({
        data: {
          organizationId: existing.organizationId,
          name: existing.name,
          keyPrefix: prefix,
          keyHash: sha256(fullKey),
          scopes: existing.scopes,
          createdBy: staffId ?? null,
        },
      }),
      this.controlPlane.apiClient.update({
        where: { id: keyId },
        data: { status: 'REVOKED' },
      }),
    ]);

    return {
      id: created.id,
      name: created.name,
      scopes: created.scopes,
      rotatedFrom: keyId,
      key: fullKey,
      keyPrefix: prefix,
    };
  }

  async revoke(keyId: string) {
    return this.controlPlane.apiClient.update({
      where: { id: keyId },
      data: { status: 'REVOKED' },
    });
  }
}

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}
