import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { promises as dns } from 'dns';
import { randomBytes } from 'crypto';
import { ControlPlanePrismaService } from '../control-plane/control-plane-prisma.service';

const PLATFORM_SUFFIXES = ['ferio.com'];
export const CNAME_TARGET = process.env.DOMAIN_CNAME_TARGET || 'sites.ferio.com';

/**
 * § Week 26 Custom Domains.
 *
 * Lifecycle: ADD (token issued) → VERIFY (DNS proof) → ACTIVE (+SSL
 * handed to the reverse proxy) → optional PRIMARY.
 *
 * Two verification drivers behind one interface:
 * - 'dns'  → real TXT `_ferio-verify.<domain>` or CNAME → sites.ferio.com
 * - 'mock' → env-gated scratch mode: any `<label>.verified.test` domain
 *   verifies without network access (used by E2E suites).
 *
 * Takeover protection: domains are globally unique, an unverified domain
 * never resolves in the tenant middleware, and re-verifying requires the
 * issuing organization's token.
 */
@Injectable()
export class DomainVerificationService {
  private readonly logger = new Logger(DomainVerificationService.name);
  private readonly mockMode =
    (process.env.DOMAIN_DNS_MODE || 'dns') === 'mock';

  constructor(private readonly controlPlane: ControlPlanePrismaService) {}

  static normalize(input: string): string {
    return String(input || '')
      .toLowerCase()
      .trim()
      .replace(/^https?:\/\//, '')
      .replace(/\/.*$/, '')
      .split(':')[0];
  }

  async addDomain(organizationId: string, rawDomain: string) {
    const domain = DomainVerificationService.normalize(rawDomain);

    if (!/^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/.test(domain)) {
      throw new BadRequestException('Invalid domain name');
    }
    if (PLATFORM_SUFFIXES.some((s) => domain === s || domain.endsWith(`.${s}`))) {
      throw new BadRequestException(
        'ferio.com subdomains are provisioned automatically — add your own domain instead',
      );
    }

    // Takeover protection: unique constraint backs this up, but we give
    // an explicit, actionable error.
    const existing = await this.controlPlane.organizationDomain.findUnique({
      where: { domain },
      select: { id: true, organizationId: true, isVerified: true },
    });
    if (existing) {
      throw new ConflictException(
        existing.isVerified && existing.organizationId !== organizationId
          ? 'Domain is already in use by another workspace'
          : 'Domain already registered',
      );
    }

    const token = `ferio-verify=${randomBytes(16).toString('hex')}`;
    const row = await this.controlPlane.organizationDomain.create({
      data: {
        organizationId,
        domain,
        verificationToken: token,
        isVerified: false,
        sslStatus: 'PENDING',
      },
    });
    return {
      ...this.publicView(row),
      verification: {
        method: 'TXT',
        record: `_ferio-verify.${domain}`,
        value: token,
        alternativeCname: `${domain} → ${CNAME_TARGET}`,
      },
    };
  }

  async listDomains(organizationId: string) {
    const rows = await this.controlPlane.organizationDomain.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => this.publicView(r));
  }

  /** Run the ownership proof. Idempotent once verified. */
  async verifyDomain(organizationId: string, domainId: string) {
    const row = await this.controlPlane.organizationDomain.findUnique({
      where: { id: domainId },
    });
    if (!row) throw new NotFoundException('Domain not found');
    if (row.organizationId !== organizationId) {
      throw new ForbiddenException('Domain belongs to another workspace');
    }
    if (row.isVerified) return { ...this.publicView(row), checked: 'already-verified' };
    if (!row.verificationToken) {
      throw new BadRequestException('No verification token issued for this domain');
    }

    const result = await this.checkDns(row.domain, row.verificationToken);

    const updated = await this.controlPlane.organizationDomain.update({
      where: { id: domainId },
      data: {
        isVerified: result.verified,
        sslStatus: result.verified ? 'ACTIVE' : row.sslStatus,
      },
    });

    await this.controlPlane.platformAuditEvent
      .create({
        data: {
          action: result.verified ? 'domain.verified' : 'domain.verify_failed',
          actorType: 'SYSTEM',
          resourceType: 'OrganizationDomain',
          resourceId: domainId,
          organizationId,
          metadata: { detail: result.detail } as any,
        },
      })
      .catch(() => {});

    this.logger.log(
      `🌐 Domain ${row.domain}: ${result.verified ? 'VERIFIED' : 'not verified'} (${result.detail})`,
    );
    return { ...this.publicView(updated), checked: result.detail };
  }

  async setPrimary(organizationId: string, domainId: string) {
    const row = await this.controlPlane.organizationDomain.findUnique({
      where: { id: domainId },
    });
    if (!row) throw new NotFoundException('Domain not found');
    if (row.organizationId !== organizationId) {
      throw new ForbiddenException('Domain belongs to another workspace');
    }
    if (!row.isVerified) {
      throw new BadRequestException('Verify the domain before making it primary');
    }
    await this.controlPlane.organizationDomain.updateMany({
      where: { organizationId, isPrimary: true },
      data: { isPrimary: false },
    });
    return this.controlPlane.organizationDomain.update({
      where: { id: domainId },
      data: { isPrimary: true },
    });
  }

  async removeDomain(organizationId: string, domainId: string) {
    const row = await this.controlPlane.organizationDomain.findUnique({
      where: { id: domainId },
    });
    if (!row) throw new NotFoundException('Domain not found');
    if (row.organizationId !== organizationId) {
      throw new ForbiddenException('Domain belongs to another workspace');
    }
    await this.controlPlane.organizationDomain.delete({ where: { id: domainId } });
    return { deleted: true };
  }

  async listAllDomains() {
    return this.controlPlane.organizationDomain.findMany({
      include: { organization: { select: { slug: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  /**
   * DNS proof: TXT `_ferio-verify.<domain>` containing the token, OR a
   * CNAME/A record pointing at the Ferio target. Mock mode stands in for
   * real DNS inside scratch environments.
   */
  private async checkDns(
    domain: string,
    token: string,
  ): Promise<{ verified: boolean; detail: string }> {
    if (this.mockMode) {
      if (domain.endsWith('.verified.test')) {
        return { verified: true, detail: 'mock-dns txt-match' };
      }
      return { verified: false, detail: 'mock-dns no matching record' };
    }

    // TXT path
    try {
      const records = await dns.resolveTxt(`_ferio-verify.${domain}`);
      const flat = records.map((chunks) => chunks.join(''));
      if (flat.includes(token)) return { verified: true, detail: 'txt-match' };
    } catch {
      /* fall through to CNAME */
    }

    // CNAME path
    try {
      const resolved = await dns.resolveCname(domain);
      if (resolved.some((r) => r === CNAME_TARGET)) {
        return { verified: true, detail: 'cname-match' };
      }
    } catch {
      /* fall through */
    }

    return {
      verified: false,
      detail: `no TXT(_ferio-verify) token nor CNAME→${CNAME_TARGET} found`,
    };
  }

  private publicView(row: {
    id: string;
    domain: string;
    isPrimary: boolean;
    isVerified: boolean;
    sslStatus: string;
    createdAt: Date;
  }) {
    return {
      id: row.id,
      domain: row.domain,
      isPrimary: row.isPrimary,
      isVerified: row.isVerified,
      sslStatus: row.sslStatus,
      createdAt: row.createdAt,
    };
  }
}
