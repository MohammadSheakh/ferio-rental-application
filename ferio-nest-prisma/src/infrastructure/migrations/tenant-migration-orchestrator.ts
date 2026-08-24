import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { resolveTenantPassword } from '../../infrastructure/tenant/tenant-credentials';
import { Client } from 'pg';
import { spawnSync } from 'child_process';
import { ControlPlanePrismaService } from '../control-plane/control-plane-prisma.service';
import { TenantDatabaseStatus } from '@prisma/control-client';

/**
 * Tenant Migration Orchestrator (§4.7)
 *
 * Rolls versioned tenant-schema migrations out across the fleet with
 * concurrency control (§21: "never migrate all tenant DBs at once").
 *
 * Safety model:
 * - A tenant being migrated has its TenantDatabase status set to
 *   MIGRATING; the tenant resolver rejects non-READY databases, which
 *   acts as automatic per-tenant maintenance mode.
 * - Bounded worker pool (default 3 concurrent migrations).
 * - Post-migration health check verifies connectivity and that no
 *   migration rows are in a failed state before re-marking READY.
 * - Every outcome is recorded on the TenantDatabase row and in the
 *   platform audit log.
 */

export interface MigrationOutcome {
  organizationId: string;
  slug: string;
  databaseName: string;
  status: 'MIGRATED' | 'SKIPPED_UP_TO_DATE' | 'FAILED' | 'UNHEALTHY';
  schemaVersion?: string;
  error?: string;
}

export interface BatchMigrationReport {
  total: number;
  migrated: number;
  skippedUpToDate: number;
  failed: number;
  unhealthy: number;
  durationMs: number;
  outcomes: MigrationOutcome[];
}

@Injectable()
export class TenantMigrationOrchestrator {
  private readonly logger = new Logger(TenantMigrationOrchestrator.name);
  private running = false;

  constructor(private readonly controlPlane: ControlPlanePrismaService) {}

  /** Migrate a single tenant database. */
  async migrateOne(organizationId: string): Promise<MigrationOutcome> {
    const org = await this.controlPlane.saasOrganization.findUnique({
      where: { id: organizationId },
      include: { database: true },
    });

    if (!org?.database) {
      throw new NotFoundException(
        `Organization ${organizationId} has no registered tenant database`,
      );
    }

    return this.migrateTenant(org.id, org.slug, org.database.databaseName);
  }

  /**
   * Migrate many tenants with bounded concurrency.
   * Pass `onlyOutdated` to skip databases already on the latest applied
   * template version.
   */
  async migrateBatch(
    organizationIds: string[],
    opts: { concurrency?: number; onlyOutdated?: boolean } = {},
  ): Promise<BatchMigrationReport> {
    const startedAt = Date.now();
    const concurrency = Math.max(1, Math.min(opts.concurrency ?? 3, 10));
    const outcomes: MigrationOutcome[] = [];

    // Simple bounded worker pool over the queue of IDs.
    let cursor = 0;
    const worker = async () => {
      while (cursor < organizationIds.length) {
        const id = organizationIds[cursor++];
        try {
          outcomes.push(await this.migrateOne(id));
        } catch (err) {
          outcomes.push({
            organizationId: id,
            slug: '?',
            databaseName: '?',
            status: 'FAILED',
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    };
    await Promise.all(Array.from({ length: concurrency }, worker));

    if (opts.onlyOutdated) {
      // Re-classify: outcomes whose version matches latest count as skipped.
      // migrateOne already skips via deploy no-op detection below.
    }

    return this.summarize(outcomes, startedAt);
  }

  /**
   * Migrate every READY tenant database. Refuses concurrent runs so two
   * operators can never double-roll the fleet simultaneously.
   */
  async migrateAll(
    opts: { concurrency?: number } = {},
  ): Promise<BatchMigrationReport> {
    if (this.running) {
      throw new Error('A batch migration is already in progress');
    }
    this.running = true;
    try {
      const dbs = await this.controlPlane.tenantDatabase.findMany({
        where: { status: 'READY' },
        select: { organizationId: true },
      });
      this.logger.log(
        `🚚 Fleet migration started for ${dbs.length} tenant DB(s)`,
      );
      return await this.migrateBatch(
        dbs.map((d) => d.organizationId),
        opts,
      );
    } finally {
      this.running = false;
    }
  }

  // ────────────────────────────────────────────────────────────
  // Internals
  // ────────────────────────────────────────────────────────────

  private async migrateTenant(
    organizationId: string,
    slug: string,
    databaseName: string,
  ): Promise<MigrationOutcome> {
    this.logger.log(`📦 Migrating tenant "${slug}" (${databaseName})`);

    // Maintenance mode: resolver rejects non-READY databases.
    await this.controlPlane.tenantDatabase.update({
      where: { organizationId },
      data: { status: TenantDatabaseStatus.MIGRATING },
    });

    try {
      const result = spawnSync(
        'npx',
        [
          'prisma',
          'migrate',
          'deploy',
          '--config',
          'prisma/tenant/prisma.config.ts',
        ],
        {
          cwd: process.cwd(),
          env: {
            ...process.env,
            TENANT_DATABASE_URL: this.tenantUrl(databaseName),
          },
          encoding: 'utf8',
          timeout: 120_000,
          windowsHide: true,
        },
      );

      const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
      if (result.status !== 0 || result.error) {
        throw new Error(output.slice(-1500) || String(result.error));
      }

      const schemaVersion = await this.readAppliedSchemaVersion(databaseName);

      // Post-migration health check before restoring traffic.
      const healthy = await this.healthCheck(databaseName);
      if (!healthy) {
        await this.controlPlane.tenantDatabase.update({
          where: { organizationId },
          data: { isHealthy: false },
        });
        await this.audit('tenant.migration_unhealthy', organizationId, {
          slug,
          schemaVersion,
        });
        return {
          organizationId,
          slug,
          databaseName,
          status: 'UNHEALTHY',
          schemaVersion,
        };
      }

      const upToDate = output.includes('No pending migrations');
      await this.controlPlane.tenantDatabase.update({
        where: { organizationId },
        data: {
          status: TenantDatabaseStatus.READY,
          schemaVersion,
          lastMigratedAt: new Date(),
          lastHealthCheck: new Date(),
          isHealthy: true,
        },
      });

      await this.audit(
        upToDate ? 'tenant.migration_skipped_current' : 'tenant.migrated',
        organizationId,
        {
          slug,
          schemaVersion,
        },
      );

      return {
        organizationId,
        slug,
        databaseName,
        status: upToDate ? 'SKIPPED_UP_TO_DATE' : 'MIGRATED',
        schemaVersion,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`❌ Migration failed for "${slug}": ${errorMessage}`);

      // Leave the tenant OUT of READY — it needs operator attention.
      await this.controlPlane.tenantDatabase
        .update({
          where: { organizationId },
          data: { status: TenantDatabaseStatus.FAILED, isHealthy: false },
        })
        .catch(() => {});
      await this.audit('tenant.migration_failed', organizationId, {
        slug,
        error: errorMessage.slice(0, 1500),
      });

      return {
        organizationId,
        slug,
        databaseName,
        status: 'FAILED',
        error: errorMessage.slice(0, 500),
      };
    }
  }

  private async healthCheck(databaseName: string): Promise<boolean> {
    const client = new Client({
      connectionString: this.tenantUrl(databaseName),
    });
    try {
      await client.connect();
      await client.query('SELECT 1');
      const { rows } = await client.query<{ failed: string }>(
        `SELECT COUNT(*)::text AS failed FROM "_prisma_migrations" WHERE "finished_at" IS NULL AND "applied_steps_count" > 0`,
      );
      return Number(rows[0]?.failed ?? 0) === 0;
    } catch {
      return false;
    } finally {
      await client.end().catch(() => {});
    }
  }

  private async readAppliedSchemaVersion(
    databaseName: string,
  ): Promise<string> {
    const client = new Client({
      connectionString: this.tenantUrl(databaseName),
    });
    try {
      await client.connect();
      const { rows } = await client.query<{ migration_name: string }>(
        `SELECT "migration_name" FROM "_prisma_migrations"
         WHERE "finished_at" IS NOT NULL
         ORDER BY "finished_at" DESC LIMIT 1`,
      );
      return rows[0]?.migration_name ?? 'unknown';
    } catch {
      return 'unknown';
    } finally {
      await client.end().catch(() => {});
    }
  }

  private tenantUrl(databaseName: string): string {
    const password =
      resolveTenantPassword(null);
    const host = process.env.TENANT_DB_HOST || 'localhost';
    const port = process.env.TENANT_DB_PORT || '5432';
    const username = process.env.TENANT_DB_USERNAME || 'postgres';
    return `postgresql://${username}:${encodeURIComponent(password)}@${host}:${port}/${databaseName}`;
  }

  private async audit(
    action: string,
    organizationId: string,
    metadata: object,
  ) {
    await this.controlPlane.platformAuditEvent
      .create({
        data: {
          action,
          actorType: 'SYSTEM',
          resourceType: 'TenantDatabase',
          resourceId: organizationId,
          organizationId,
          metadata: metadata as any,
        },
      })
      .catch(() => {});
  }

  private summarize(
    outcomes: MigrationOutcome[],
    startedAt: number,
  ): BatchMigrationReport {
    const report: BatchMigrationReport = {
      total: outcomes.length,
      migrated: outcomes.filter((o) => o.status === 'MIGRATED').length,
      skippedUpToDate: outcomes.filter((o) => o.status === 'SKIPPED_UP_TO_DATE')
        .length,
      failed: outcomes.filter((o) => o.status === 'FAILED').length,
      unhealthy: outcomes.filter((o) => o.status === 'UNHEALTHY').length,
      durationMs: Date.now() - startedAt,
      outcomes,
    };
    this.logger.log(
      `🏁 Fleet migration finished: ${report.migrated} migrated, ${report.skippedUpToDate} current, ${report.failed} failed, ${report.unhealthy} unhealthy (${report.durationMs}ms)`,
    );
    return report;
  }
}
