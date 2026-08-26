import {
  Injectable,
  Logger,
  OnModuleDestroy,
  NotFoundException,
} from '@nestjs/common';
import { PrismaClient as TenantPrismaClient } from '@prisma/tenant-client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { ControlPlanePrismaService } from '../control-plane/control-plane-prisma.service';
import { tlsOptionsFromUrl } from './tls-options';
import { buildTenantUrl } from './tenant-credentials';

export { tlsOptionsFromUrl };

interface CachedConnection {
  client: TenantPrismaClient;
  lastAccessedAt: number;
  databaseUrl: string;
}

@Injectable()
export class TenantDatabaseManager implements OnModuleDestroy {
  private readonly logger = new Logger(TenantDatabaseManager.name);
  private readonly cache = new Map<string, CachedConnection>();

  /** Env-tunable ceiling (§ hardening): TENANT_MAX_POOL_SIZE, default 50.
   *  Pair with pgBouncer when fleet size × per-tenant pools approach server max_connections. */
  private readonly MAX_POOL_SIZE = Number(process.env.TENANT_MAX_POOL_SIZE || 50);
  private readonly CONNECTION_TTL_MS = 10 * 60 * 1000;
  private readonly CLEANUP_INTERVAL_MS = 2 * 60 * 1000;

  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(private readonly controlPlane: ControlPlanePrismaService) {
    this.cleanupTimer = setInterval(() => {
      this.evictIdleConnections();
    }, this.CLEANUP_INTERVAL_MS);
  }

  /**
   * Get or instantiate a Prisma client connected to a tenant's database by organizationId.
   */
  async getTenantDatabase(organizationId: string): Promise<TenantPrismaClient> {
    const existing = this.cache.get(organizationId);
    if (existing) {
      existing.lastAccessedAt = Date.now();
      return existing.client;
    }

    const tenantDbRecord = await this.controlPlane.tenantDatabase.findUnique({
      where: { organizationId },
    });

    if (!tenantDbRecord || tenantDbRecord.status !== 'READY') {
      throw new NotFoundException(
        `Tenant database for organization ${organizationId} is not ready`,
      );
    }

    return this.getClient(organizationId, buildTenantUrl(tenantDbRecord));
  }

  /**
   * Get or create a Prisma client for a specific tenant database.
   *
   * @param tenantId - Unique identifier for the tenant (organization ID)
   * @param databaseUrl - PostgreSQL connection URL for this tenant's DB
   * @returns PrismaClient connected to the tenant's database
   */
  async getClient(
    tenantId: string,
    databaseUrl: string,
  ): Promise<TenantPrismaClient> {
    const existing = this.cache.get(tenantId);

    if (existing) {
      // Refresh last accessed timestamp
      existing.lastAccessedAt = Date.now();
      return existing.client;
    }

    // Evict oldest connection if pool is at capacity
    if (this.cache.size >= this.MAX_POOL_SIZE) {
      this.evictOldestConnection();
    }

    // Create new connection (Prisma 7: driver adapter per tenant pool)
    const { connectionString, ssl } = tlsOptionsFromUrl(databaseUrl);
    const pool = new Pool({
      connectionString,
      ssl,
      max: 5, // bounded per-tenant pool; global cap enforced by MAX_POOL_SIZE
    });
    const client = new TenantPrismaClient({
      adapter: new PrismaPg(pool),
      log:
        process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    } as any);

    await client.$connect();

    this.cache.set(tenantId, {
      client,
      lastAccessedAt: Date.now(),
      databaseUrl,
    });

    this.logger.log(
      `🔗 Tenant DB connected: ${tenantId} (pool: ${this.cache.size}/${this.MAX_POOL_SIZE})`,
    );
    return client;
  }

  /**
   * Disconnect a specific tenant's database connection.
   */
  async disconnectTenant(tenantId: string): Promise<void> {
    const entry = this.cache.get(tenantId);
    if (entry) {
      await entry.client.$disconnect();
      this.cache.delete(tenantId);
      this.logger.log(`🔌 Tenant DB disconnected: ${tenantId}`);
    }
  }

  /**
   * Get current pool statistics for monitoring.
   */
  getPoolStats() {
    return {
      activeConnections: this.cache.size,
      maxPoolSize: this.MAX_POOL_SIZE,
      connectionTtlMs: this.CONNECTION_TTL_MS,
      tenantIds: Array.from(this.cache.keys()),
    };
  }

  /**
   * Evict connections that have been idle longer than TTL.
   */
  private evictIdleConnections(): void {
    const now = Date.now();
    const evicted: string[] = [];

    for (const [tenantId, entry] of this.cache) {
      if (now - entry.lastAccessedAt > this.CONNECTION_TTL_MS) {
        entry.client.$disconnect().catch((err) => {
          this.logger.warn(
            `Failed to disconnect idle tenant ${tenantId}: ${err.message}`,
          );
        });
        this.cache.delete(tenantId);
        evicted.push(tenantId);
      }
    }

    if (evicted.length > 0) {
      this.logger.log(
        `♻️  Evicted ${evicted.length} idle tenant connection(s): ${evicted.join(', ')}`,
      );
    }
  }

  /**
   * Evict the least recently used connection when pool is full.
   */
  private evictOldestConnection(): void {
    let oldestId: string | null = null;
    let oldestTime = Infinity;

    for (const [tenantId, entry] of this.cache) {
      if (entry.lastAccessedAt < oldestTime) {
        oldestTime = entry.lastAccessedAt;
        oldestId = tenantId;
      }
    }

    if (oldestId) {
      const entry = this.cache.get(oldestId);
      entry?.client.$disconnect().catch(() => {});
      this.cache.delete(oldestId);
      this.logger.warn(`⚠️  Evicted LRU tenant connection: ${oldestId}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    // Disconnect all tenant connections
    const disconnectPromises = Array.from(this.cache.entries()).map(
      async ([tenantId, entry]) => {
        try {
          await entry.client.$disconnect();
        } catch (err) {
          this.logger.warn(
            `Failed to disconnect tenant ${tenantId} on shutdown`,
          );
        }
      },
    );

    await Promise.allSettled(disconnectPromises);
    this.cache.clear();
    this.logger.log('🔌 All tenant database connections closed');
  }
}
