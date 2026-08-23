import {
  Injectable,
  NestMiddleware,
  UnauthorizedException,
  ServiceUnavailableException,
  Logger,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ControlPlanePrismaService } from '../control-plane/control-plane-prisma.service';

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

  /** Simple in-memory cache for tenant lookups (Redis in production) */
  private readonly cache = new Map<
    string,
    { context: TenantContext; expiresAt: number }
  >();
  private readonly CACHE_TTL_MS = 60_000; // 1 minute

  constructor(private readonly controlPlane: ControlPlanePrismaService) {}

  async use(req: Request, _res: Response, next: NextFunction) {
    const slug = this.extractSlug(req);

    if (!slug) {
      // Not a tenant request — pass through (marketplace or public routes)
      return next();
    }

    try {
      const context = await this.resolveContext(slug);
      req.tenantContext = context;
      next();
    } catch (err) {
      next(err);
    }
  }

  /**
   * Extract the tenant slug from the request.
   *
   * Priority:
   * 1. `X-Tenant-Slug` header (dev override)
   * 2. Subdomain from Host header (e.g. "rahman" from "rahman.ferio.com")
   */
  private extractSlug(req: Request): string | null {
    // Dev override header
    const headerSlug = req.headers['x-tenant-slug'] as string | undefined;
    if (headerSlug) {
      return headerSlug.toLowerCase().trim();
    }

    // Extract from Host
    const host = req.headers.host;
    if (!host) return null;

    // Remove port
    const hostname = host.split(':')[0];

    // Skip localhost / IP addresses / platform domains
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === 'ferio.com' ||
      hostname === 'www.ferio.com' ||
      hostname === 'api.ferio.com' ||
      hostname === 'admin.ferio.com'
    ) {
      return null;
    }

    // Extract first subdomain: "rahman.ferio.com" → "rahman"
    const parts = hostname.split('.');
    if (parts.length >= 3) {
      return parts[0].toLowerCase();
    }

    return null;
  }

  /**
   * Resolve tenant context from slug with caching.
   */
  private async resolveContext(slug: string): Promise<TenantContext> {
    // Check cache
    const cached = this.cache.get(slug);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.context;
    }

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
    this.cache.set(slug, {
      context,
      expiresAt: Date.now() + this.CACHE_TTL_MS,
    });

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
  }): string {
    // In production, password would come from a secret manager.
    // Canonical: TENANT_DB_PASSWORD (TENANT_DB_DEFAULT_PASSWORD kept as legacy alias)
    const password =
      process.env.TENANT_DB_PASSWORD ||
      process.env.TENANT_DB_DEFAULT_PASSWORD ||
      'postgres';
    return `postgresql://${db.username}:${encodeURIComponent(password)}@${db.host}:${db.port}/${db.databaseName}?sslmode=${db.sslMode}`;
  }

  /**
   * Invalidate cache for a specific slug (e.g. after status change).
   */
  invalidateCache(slug: string): void {
    this.cache.delete(slug);
  }

  /**
   * Clear entire cache.
   */
  clearCache(): void {
    this.cache.clear();
  }
}
