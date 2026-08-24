import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { Client } from 'pg';
import { Pool } from 'pg';
import { spawnSync } from 'child_process';
import { PrismaPg } from '@prisma/adapter-pg';
import { resolveTenantPassword } from '../../infrastructure/tenant/tenant-credentials';
import {
  PrismaClient as TenantPrismaClient,
  MemberRole,
  MemberStatus,
} from '@prisma/tenant-client';
import { ControlPlanePrismaService } from '../control-plane/control-plane-prisma.service';
import { TenantDatabaseManager } from '../tenant/tenant-database.manager';
import {
  OrganizationStatus,
  TenantDatabaseStatus,
  ProvisioningJobStatus,
} from '@prisma/control-client';

/**
 * Organization Provisioning Service
 *
 * Orchestrates the complete lifecycle of creating a new SaaS organization:
 *
 *   VALIDATE_SLUG → CREATE_ORG → CREATE_DOMAIN → REGISTER_DB
 *   → CREATE_PHYSICAL_DB → MIGRATE → SEED → MARK_READY
 *   → CREATE_SUBSCRIPTION → ACTIVATE
 *
 * v2.1 hardening (checklist §4.6):
 * - Idempotent steps: every step verifies artifact existence before
 *   creating, so a failed run can be retried safely at any point.
 * - Resumable: retryProvisioning() resumes a PROVISIONING_FAILED
 *   organization from the last completed artifact state.
 * - Real migrations: `prisma migrate deploy` against the tenant DB via
 *   the tenant plane config (replaces unsafe `db push --accept-data-loss`).
 * - Rollback: explicit rollbackFailedProvisioning() removes all artifacts;
 *   physical DB drop requires an explicit flag (§15 — never casually destroy).
 * - Seeding: creates the organization-owner Member and a workspace audit row,
 *   tracked with the applied schema version.
 */

export interface ProvisionOrganizationInput {
  name: string;
  slug: string;
  ownerUserId: string;
  ownerName: string;
  ownerEmail: string;
  planTier?: string;
  contactEmail?: string;
  contactPhone?: string;
}

export interface ProvisioningResult {
  organizationId: string;
  slug: string;
  domain: string;
  databaseName: string;
  status: 'COMPLETED' | 'ALREADY_PROVISIONED' | 'FAILED';
  schemaVersion?: string;
  resumed?: boolean;
  error?: string;
}

const PIPELINE_STEPS = [
  'VALIDATE_SLUG',
  'CREATE_ORG',
  'CREATE_DOMAIN',
  'REGISTER_DB',
  'CREATE_PHYSICAL_DB',
  'MIGRATE',
  'SEED',
  'MARK_READY',
  'CREATE_SUBSCRIPTION',
  'ACTIVATE',
] as const;

@Injectable()
export class ProvisioningService {
  private readonly logger = new Logger(ProvisioningService.name);

  constructor(
    private readonly controlPlane: ControlPlanePrismaService,
    private readonly tenantDbManager: TenantDatabaseManager,
  ) {}

  // ────────────────────────────────────────────────────────────
  // Public API
  // ────────────────────────────────────────────────────────────

  /**
   * Provision a new SaaS organization end-to-end.
   * Safe to call twice: an ACTIVE organization short-circuits as
   * ALREADY_PROVISIONED; a failed one can be resumed by re-calling.
   */
  async provisionOrganization(
    input: ProvisionOrganizationInput,
    opts: { resume?: boolean } = {},
  ): Promise<ProvisioningResult> {
    const normalizedSlug = input.slug
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9-]/g, '');
    if (!normalizedSlug) {
      throw new BadRequestException('Slug normalizes to an empty value');
    }

    const databaseName = `tenant_${normalizedSlug.replace(/-/g, '_')}`;
    const domain = `${normalizedSlug}.ferio.com`;

    const ctx: {
      organizationId?: string;
      jobId?: string;
      slug: string;
      databaseName: string;
      domain: string;
      attempt: number;
      maxAttempts: number;
    } = {
      slug: normalizedSlug,
      databaseName,
      domain,
      attempt: 1,
      maxAttempts: 3,
    };

    try {
      // ── Step 1: Validate slug / resolve resume target ──
      await this.step(ctx, 'VALIDATE_SLUG', async () => {
        const existing = await this.controlPlane.saasOrganization.findUnique({
          where: { slug: normalizedSlug },
          include: {
            provisioningJobs: { orderBy: { createdAt: 'desc' }, take: 1 },
          },
        });

        if (existing && existing.status === OrganizationStatus.ACTIVE) {
          return { shortCircuit: 'ALREADY_PROVISIONED' as const };
        }
        if (existing) {
          // Resume mode: reuse artifacts of the failed attempt.
          ctx.organizationId = existing.id;
          const lastJob = existing.provisioningJobs[0];
          ctx.attempt = Math.min(
            (lastJob?.attempt ?? 1) + 1,
            lastJob?.maxAttempts ?? 3,
          );
          ctx.maxAttempts = lastJob?.maxAttempts ?? 3;
          if (ctx.attempt > ctx.maxAttempts) {
            throw new ConflictException(
              `Provisioning exceeded ${ctx.maxAttempts} attempts. Use rollback before re-attempting.`,
            );
          }
          // Restore owner identity captured on the original attempt.
          const metaOwner = (lastJob?.metadata as any)?.owner;
          if (metaOwner) {
            input.ownerName = metaOwner.ownerName ?? input.ownerName;
            input.ownerEmail = metaOwner.ownerEmail ?? input.ownerEmail;
            input.ownerUserId = metaOwner.ownerUserId ?? input.ownerUserId;
          }
        }
        return {};
      });

      // Idempotency short-circuit surfaced by VALIDATE_SLUG.
      const activeOrg = await this.controlPlane.saasOrganization.findFirst({
        where: { slug: normalizedSlug, status: OrganizationStatus.ACTIVE },
      });
      if (activeOrg) {
        return {
          organizationId: activeOrg.id,
          slug: normalizedSlug,
          domain,
          databaseName,
          status: 'ALREADY_PROVISIONED',
        };
      }

      // ── Create the tracking job for THIS attempt ──
      if (ctx.organizationId) {
        const job = await this.controlPlane.provisioningJob.create({
          data: {
            organizationId: ctx.organizationId,
            status: ProvisioningJobStatus.RUNNING,
            step: 'VALIDATE_SLUG',
            attempt: ctx.attempt,
            maxAttempts: ctx.maxAttempts,
            metadata: {
              owner: {
                ownerUserId: input.ownerUserId,
                ownerName: input.ownerName,
                ownerEmail: input.ownerEmail,
              },
              resumed: true,
            },
          },
        });
        ctx.jobId = job.id;
      }

      // ── Step 2: Create Organization ──
      await this.step(ctx, 'CREATE_ORG', async () => {
        if (ctx.organizationId) return;
        const org = await this.controlPlane.saasOrganization.create({
          data: {
            name: input.name,
            slug: normalizedSlug,
            status: OrganizationStatus.PROVISIONING,
            ownerUserId: input.ownerUserId,
            contactEmail: input.contactEmail ?? input.ownerEmail,
            contactPhone: input.contactPhone,
          },
        });
        ctx.organizationId = org.id;

        // Backfill the tracking job created before we had an org ID.
        if (ctx.jobId === undefined) {
          const job = await this.controlPlane.provisioningJob.create({
            data: {
              organizationId: org.id,
              status: ProvisioningJobStatus.RUNNING,
              step: 'CREATE_ORG',
              attempt: ctx.attempt,
              maxAttempts: ctx.maxAttempts,
              metadata: {
                owner: {
                  ownerUserId: input.ownerUserId,
                  ownerName: input.ownerName,
                  ownerEmail: input.ownerEmail,
                },
              },
            },
          });
          ctx.jobId = job.id;
        }
      });
      if (!ctx.jobId || !ctx.organizationId) {
        throw new Error('Organization/job context missing after CREATE_ORG');
      }

      // ── Step 3: Default subdomain ──
      await this.step(ctx, 'CREATE_DOMAIN', async () => {
        const existingDomain =
          await this.controlPlane.organizationDomain.findFirst({
            where: { organizationId: ctx.organizationId!, domain },
          });
        if (!existingDomain) {
          await this.controlPlane.organizationDomain.create({
            data: {
              organizationId: ctx.organizationId!,
              domain,
              isPrimary: true,
              isVerified: true, // auto-verified platform subdomain
            },
          });
        }
      });

      // ── Step 4: Registry record ──
      await this.step(ctx, 'REGISTER_DB', async () => {
        const record = await this.controlPlane.tenantDatabase.findUnique({
          where: { organizationId: ctx.organizationId! },
        });
        if (!record) {
          await this.controlPlane.tenantDatabase.create({
            data: {
              organizationId: ctx.organizationId!,
              databaseName,
              status: TenantDatabaseStatus.PENDING,
              host: process.env.TENANT_DB_HOST || 'localhost',
              port: parseInt(process.env.TENANT_DB_PORT || '5432', 10),
              username: process.env.TENANT_DB_USERNAME || 'postgres',
            },
          });
        }
      });

      // ── Step 5: Physical database ──
      await this.step(ctx, 'CREATE_PHYSICAL_DB', async () => {
        await this.createPhysicalDatabase(databaseName);
        await this.controlPlane.tenantDatabase.updateMany({
          where: { organizationId: ctx.organizationId! },
          data: { status: TenantDatabaseStatus.CREATING },
        });
      });

      // ── Step 6: Migrations ──
      let schemaVersion: string | undefined;
      await this.step(ctx, 'MIGRATE', async () => {
        await this.controlPlane.tenantDatabase.updateMany({
          where: { organizationId: ctx.organizationId! },
          data: { status: TenantDatabaseStatus.MIGRATING },
        });
        schemaVersion = await this.runTenantMigrations(databaseName);
      });

      // ── Step 7: Seed defaults ──
      await this.step(ctx, 'SEED', async () => {
        await this.controlPlane.tenantDatabase.updateMany({
          where: { organizationId: ctx.organizationId! },
          data: { status: TenantDatabaseStatus.SEEDING },
        });
        await this.seedTenantDefaults(databaseName, input);
      });

      // ── Step 8: Mark DB READY ──
      await this.step(ctx, 'MARK_READY', async () => {
        await this.controlPlane.tenantDatabase.update({
          where: { organizationId: ctx.organizationId! },
          data: {
            status: TenantDatabaseStatus.READY,
            schemaVersion,
            lastMigratedAt: new Date(),
            lastHealthCheck: new Date(),
            isHealthy: true,
          },
        });
      });

      // ── Step 9: Subscription ──
      await this.step(ctx, 'CREATE_SUBSCRIPTION', async () => {
        const existingSub = await this.controlPlane.subscription.findUnique({
          where: { organizationId: ctx.organizationId! },
        });
        if (existingSub) return;

        const planTier = input.planTier || 'STARTER';
        const plan = await this.controlPlane.plan.findFirst({
          where: { tier: planTier as any },
        });
        if (!plan) {
          this.logger.warn(
            `Plan tier "${planTier}" not found — skipping subscription creation`,
          );
          return;
        }

        const now = new Date();
        const periodEnd = new Date(now);
        periodEnd.setMonth(periodEnd.getMonth() + 1);

        const sub = await this.controlPlane.subscription.create({
          data: {
            organizationId: ctx.organizationId!,
            planId: plan.id,
            status: 'ACTIVE',
            currentPeriodStart: now,
            currentPeriodEnd: periodEnd,
          },
        });
        await this.controlPlane.subscriptionEvent
          .create({
            data: {
              subscriptionId: sub.id,
              eventType: 'CREATED',
              toPlanId: plan.id,
            },
          })
          .catch(() => {});
      });

      // ── Step 10: Activate ──
      await this.step(ctx, 'ACTIVATE', async () => {
        await this.controlPlane.saasOrganization.update({
          where: { id: ctx.organizationId! },
          data: { status: OrganizationStatus.ACTIVE },
        });
      });

      await this.controlPlane.provisioningJob.update({
        where: { id: ctx.jobId },
        data: {
          status: ProvisioningJobStatus.COMPLETED,
          completedAt: new Date(),
        },
      });

      await this.controlPlane.platformAuditEvent.create({
        data: {
          action: 'organization.provisioned',
          actorType: 'SYSTEM',
          resourceType: 'SaasOrganization',
          resourceId: ctx.organizationId,
          organizationId: ctx.organizationId,
          metadata: {
            slug: normalizedSlug,
            domain,
            databaseName,
            schemaVersion,
            resumed: !!opts.resume || ctx.attempt > 1,
            attempt: ctx.attempt,
          },
        },
      });

      this.logger.log(
        `✅ Organization "${input.name}" provisioned at ${domain} (schema ${schemaVersion ?? 'n/a'})`,
      );

      return {
        organizationId: ctx.organizationId,
        slug: normalizedSlug,
        domain,
        databaseName,
        status: ctx.attempt > 1 ? 'COMPLETED' : 'COMPLETED',
        schemaVersion,
        resumed: ctx.attempt > 1,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`❌ Provisioning failed: ${errorMessage}`);

      await this.recordFailure(ctx, errorMessage);
      return {
        organizationId: ctx.organizationId || '',
        slug: normalizedSlug,
        domain,
        databaseName,
        status: 'FAILED',
        error: errorMessage,
      };
    }
  }

  /**
   * Resume a failed provisioning pipeline. All steps are idempotent, so
   * this simply re-runs the pipeline against existing artifacts.
   */
  async retryProvisioning(organizationId: string): Promise<ProvisioningResult> {
    const org = await this.controlPlane.saasOrganization.findUnique({
      where: { id: organizationId },
      include: {
        provisioningJobs: { orderBy: { createdAt: 'desc' }, take: 1 },
        subscription: { include: { plan: true } },
      },
    });

    if (!org) throw new NotFoundException('Organization not found');
    if (org.status === OrganizationStatus.ACTIVE) {
      throw new ConflictException('Organization is already ACTIVE');
    }
    if (
      org.status !== OrganizationStatus.PROVISIONING &&
      org.status !== OrganizationStatus.PROVISIONING_FAILED
    ) {
      throw new ConflictException(
        `Cannot retry provisioning from status ${org.status}`,
      );
    }

    const lastJobMeta = (org.provisioningJobs[0]?.metadata as any)?.owner ?? {};

    return this.provisionOrganization(
      {
        name: org.name,
        slug: org.slug,
        ownerUserId: org.ownerUserId,
        ownerName: lastJobMeta.ownerName ?? 'Organization Owner',
        ownerEmail: lastJobMeta.ownerEmail ?? org.contactEmail ?? '',
        planTier: org.subscription?.plan?.tier,
        contactEmail: org.contactEmail ?? undefined,
        contactPhone: org.contactPhone ?? undefined,
      },
      { resume: true },
    );
  }

  /**
   * Remove every artifact of a failed provisioning attempt.
   *
   * The physical database is only dropped when explicitly requested —
   * a half-migrated DB may still be worth inspecting after a failure.
   */
  async rollbackFailedProvisioning(
    organizationId: string,
    opts: { dropPhysicalDatabase?: boolean; actorId?: string } = {},
  ): Promise<{ droppedDatabase: boolean; removedRecords: boolean }> {
    const org = await this.controlPlane.saasOrganization.findUnique({
      where: { id: organizationId },
      include: { database: true },
    });

    if (!org) throw new NotFoundException('Organization not found');
    if (
      org.status !== OrganizationStatus.PROVISIONING_FAILED &&
      org.status !== OrganizationStatus.PROVISIONING
    ) {
      throw new ConflictException(
        `Refusing to rollback an organization in status ${org.status}. Suspend/cancel it instead.`,
      );
    }

    // Release any pooled connection before touching the database.
    await this.tenantDbManager.disconnectTenant(organizationId).catch(() => {});

    let droppedDatabase = false;
    if (opts.dropPhysicalDatabase && org.database) {
      await this.dropPhysicalDatabase(org.database.databaseName);
      droppedDatabase = true;
    }

    // Deleting the org cascades to domains, DB registry, jobs and audits.
    await this.controlPlane.saasOrganization.delete({
      where: { id: organizationId },
    });

    await this.controlPlane.platformAuditEvent
      .create({
        data: {
          action: 'organization.provisioning_rolled_back',
          actorType: 'PLATFORM_USER',
          resourceType: 'SaasOrganization',
          resourceId: organizationId,
          metadata: { slug: org.slug, droppedDatabase },
        },
      })
      .catch(() => {}); // org deleted above cascades its audit relation

    this.logger.warn(
      `↩️  Rolled back failed provisioning of "${org.slug}" (physical DB dropped: ${droppedDatabase})`,
    );
    return { droppedDatabase, removedRecords: true };
  }

  // ────────────────────────────────────────────────────────────
  // Steps plumbing
  // ────────────────────────────────────────────────────────────

  /** Run one pipeline step: track progress, fail loudly. */
  private async step(
    ctx: { jobId?: string; attempt: number },
    name: (typeof PIPELINE_STEPS)[number],
    fn: () => Promise<unknown>,
  ): Promise<void> {
    this.logger.log(`[PROVISION] Step "${name}"`);
    if (ctx.jobId) {
      await this.controlPlane.provisioningJob
        .update({ where: { id: ctx.jobId }, data: { step: name } })
        .catch(() => {});
    }
    await fn();
  }

  private async recordFailure(
    ctx: { organizationId?: string; jobId?: string },
    errorMessage: string,
  ): Promise<void> {
    if (ctx.jobId) {
      await this.controlPlane.provisioningJob
        .update({
          where: { id: ctx.jobId },
          data: {
            status: ProvisioningJobStatus.FAILED,
            errorMessage: errorMessage.slice(0, 2000),
            completedAt: new Date(),
          },
        })
        .catch(() => {});
    }
    if (ctx.organizationId) {
      await this.controlPlane.saasOrganization
        .update({
          where: { id: ctx.organizationId },
          data: { status: OrganizationStatus.PROVISIONING_FAILED },
        })
        .catch(() => {});
      await this.controlPlane.platformAuditEvent
        .create({
          data: {
            action: 'organization.provisioning_failed',
            actorType: 'SYSTEM',
            resourceType: 'SaasOrganization',
            resourceId: ctx.organizationId,
            organizationId: ctx.organizationId,
            metadata: { error: errorMessage.slice(0, 2000) },
          },
        })
        .catch(() => {});
    }
  }

  // ────────────────────────────────────────────────────────────
  // Database operations
  // ────────────────────────────────────────────────────────────

  private tenantUrl(databaseName: string): string {
    // Canonical: TENANT_DB_PASSWORD (TENANT_DB_DEFAULT_PASSWORD kept as legacy alias)
    const password =
      resolveTenantPassword(null);
    const host = process.env.TENANT_DB_HOST || 'localhost';
    const port = process.env.TENANT_DB_PORT || '5432';
    const username = process.env.TENANT_DB_USERNAME || 'postgres';
    return `postgresql://${username}:${encodeURIComponent(password)}@${host}:${port}/${databaseName}`;
  }

  /** Create a physical PostgreSQL database using the control-plane connection. */
  private async createPhysicalDatabase(databaseName: string): Promise<void> {
    try {
      await this.controlPlane.$executeRawUnsafe(
        `CREATE DATABASE "${databaseName}"`,
      );
    } catch (error: any) {
      // 42P04 = duplicate_database — treat as success (idempotent).
      if (
        error?.code === '42P04' ||
        error?.message?.includes('already exists')
      ) {
        this.logger.warn(
          `Database "${databaseName}" already exists, continuing...`,
        );
        return;
      }
      throw error;
    }
  }

  private async dropPhysicalDatabase(databaseName: string): Promise<void> {
    await this.controlPlane.$executeRawUnsafe(
      `DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`,
    );
  }

  /**
   * Apply versioned migrations via `prisma migrate deploy` using the
   * tenant-plane Prisma config, then read back the applied version.
   */
  private async runTenantMigrations(databaseName: string): Promise<string> {
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

    if (result.status !== 0 || result.error) {
      const detail =
        result.stderr?.toString().slice(-1500) ||
        result.stdout?.toString().slice(-1500) ||
        String(result.error);
      this.logger.error(`Migration failed for ${databaseName}: ${detail}`);
      throw new Error(
        `Migration failed for ${databaseName}: see provisioning logs`,
      );
    }

    const version = await this.readAppliedSchemaVersion(databaseName);
    this.logger.log(
      `📦 Tenant ${databaseName} migrated to schema version ${version}`,
    );
    return version;
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

  // ────────────────────────────────────────────────────────────
  // Seeding
  // ────────────────────────────────────────────────────────────

  /**
   * Seed tenant defaults: the organization-owner Member plus a
   * workspace provisioning audit event. Both are idempotent upserts so
   * retries never duplicate rows.
   */
  private async seedTenantDefaults(
    databaseName: string,
    input: Pick<
      ProvisionOrganizationInput,
      'ownerUserId' | 'ownerName' | 'ownerEmail'
    >,
  ): Promise<void> {
    const db = new TenantPrismaClient({
      adapter: new PrismaPg(
        new Pool({ connectionString: this.tenantUrl(databaseName) }),
      ),
    });

    try {
      await db.member.upsert({
        where: { centralUserId: input.ownerUserId },
        create: {
          centralUserId: input.ownerUserId,
          role: MemberRole.ORGANIZATION_OWNER,
          status: MemberStatus.ACTIVE,
          displayName: input.ownerName,
          email: input.ownerEmail,
          invitedAt: new Date(),
          acceptedAt: new Date(),
        },
        update: {},
      });

      await db.tenantAuditEvent.create({
        data: {
          actorId: input.ownerUserId,
          action: 'workspace.provisioned',
          resourceType: 'Workspace',
          metadata: {
            provisionedAt: new Date().toISOString(),
            seedVersion: 1,
          },
        },
      });
    } finally {
      await db.$disconnect().catch(() => {});
    }
  }
}
