import {
  Injectable,
  NestMiddleware,
  UnauthorizedException,
  ServiceUnavailableException,
  Logger,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ControlPlanePrismaService } from '../control-plane/control-plane-prisma.service';
import { TenantCacheService } from './tenant-cache.service';
import { buildTenantUrl } from './tenant-credentials';

/**
 * Tenant Context — attached to every request within the SaaS tenant plane
 */
export interface TenantContext {
  organizationId: string;
  organizationSlug: string;
  organizationName: string;
  organizationStatus: string;
  databaseName: string;
  databaseUrl: string;
}

// Extend Express Request to carry tenant context
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      tenantContext?: TenantContext;
    }
  }
}

/**
 * Tenant Resolver Middleware
 *
 * Intercepts incoming requests to the SaaS tenant plane and resolves
 * the target organization from the `Host` header (subdomain).
 *
 * Flow:
 * 1. Extract subdomain from Host header
 * 2. Look up organization by slug in Control Plane DB
 * 3. Verify organization status (ACTIVE, PAST_DUE allowed; SUSPENDED/CANCELLED blocked)
 * 4. Look up tenant database connection info
 * 5. Attach TenantContext to the request
 *
 * Local development: Use `X-Tenant-Slug` header as override.
 */
@Injectable()
export class TenantResolverMiddleware implements NestMiddleware {
  private readonly logger = new Logger(TenantResolverMiddleware.name);

  constructor(
    private readonly controlPlane: ControlPlanePrismaService,
    private readonly cacheStore: TenantCacheService,
  ) {}

  async use(req: Request, _res: Response, next: NextFunction) {
    // The override exists only for local/scratch clients. Production tenant
    // selection must come from a verified host or custom domain.
    const headerSlug = req.headers['x-tenant-slug'] as string | undefined;
    if (headerSlug && process.env.NODE_ENV !== 'production') {
      try {
        const context = await this.resolveContext(headerSlug.toLowerCase().trim());
        req.tenantContext = context;
        return next();
      } catch (err) {
        return next(err);
      }
    }

    const host = req.headers.host;
    if (!host) return next();
    const hostname = host.split(':')[0].toLowerCase();

    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === 'ferio.com' ||
      hostname === 'www.ferio.com' ||
      hostname === 'api.ferio.com' ||
      hostname === 'admin.ferio.com'
    ) {
      return next();
    }

    try {
      // § Week 26: verified custom domains resolve before subdomain rules —
      // unverified/foreign custom hosts must NOT resolve (takeover guard).
      const customOrg = await this.findOrganizationByCustomDomain(hostname);
      if (customOrg) {
        req.tenantContext = await this.resolveContext(customOrg);
        return next();
      }

      const parts = hostname.split('.');
      if (parts.length >= 3) {
        req.tenantContext = await this.resolveContext(parts[0].toLowerCase());
        return next();
      }
      return next();
    } catch (err) {
      next(err);
    }
  }

  /** Cached lookup: hostname → verified owning org's slug.
   *  Only POSITIVE results are cached so a freshly-verified domain
   *  resolves immediately (a null must never poison the cache). */
  private async findOrganizationByCustomDomain(
    hostname: string,
  ): Promise<string | null> {
    const cached = this.cacheStore.getDomain(hostname);
    if (cached !== undefined) return cached;

    const row = await this.controlPlane.organizationDomain.findUnique({
      where: { domain: hostname },
      select: { isVerified: true, organization: { select: { slug: true } } },
    });
    const slug =
      row && row.isVerified && row.organization ? row.organization.slug : null;
    if (slug) this.cacheStore.setDomain(hostname, slug);
    return slug;
  }

  /**
   * Resolve tenant context from slug with caching.
   */
  private async resolveContext(slug: string): Promise<TenantContext> {
    // Check cache
    const cached = this.cacheStore.getContext(slug);
    if (cached) return cached;

    // Query Control Plane
    const org = await this.controlPlane.saasOrganization.findUnique({
      where: { slug },
      include: {
        database: true,
        domains: { where: { isPrimary: true } },
      },
    });

    if (!org) {
      this.logger.warn(`Tenant not found: ${slug}`);
      throw new UnauthorizedException(`Organization not found`);
    }

    // Check organization status
    if (
      org.status === 'SUSPENDED' ||
      org.status === 'CANCELLED' ||
      org.status === 'ARCHIVED'
    ) {
      this.logger.warn(`Tenant access blocked (${org.status}): ${slug}`);
      throw new UnauthorizedException(
        `Organization is ${org.status.toLowerCase()}. Please contact support.`,
      );
    }

    if (org.status === 'PROVISIONING' || org.status === 'PROVISIONING_FAILED') {
      throw new ServiceUnavailableException(
        'Organization is still being provisioned. Please try again shortly.',
      );
    }

    // Verify database is ready
    if (!org.database || org.database.status !== 'READY') {
      throw new ServiceUnavailableException(
        'Organization database is not yet available. Please try again shortly.',
      );
    }

    // Build database URL
    const db = org.database;
    const databaseUrl = this.buildDatabaseUrl(db);

    const context: TenantContext = {
      organizationId: org.id,
      organizationSlug: org.slug,
      organizationName: org.name,
      organizationStatus: org.status,
      databaseName: db.databaseName,
      databaseUrl,
    };

    // Cache result
    this.cacheStore.setContext(slug, context);

    return context;
  }

  /**
   * Build PostgreSQL connection URL from tenant database record.
   */
  private buildDatabaseUrl(db: {
    host: string;
    port: number;
    username: string;
    databaseName: string;
    sslMode: string;
    passwordRef?: string | null;
  }): string {
    return buildTenantUrl(db);
  }

  /**
   * Invalidate cache for a specific slug (e.g. after status change).
   */
  invalidateCache(slug: string): void {
    this.cacheStore.invalidateContext(slug);
  }

  /** Clear entire cache. */
  clearCache(): void {
    this.cacheStore.clear();
  }
}
