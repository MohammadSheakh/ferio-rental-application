import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Patch,
  HttpCode,
  HttpStatus,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ControlPlanePrismaService } from '../control-plane/control-plane-prisma.service';
import { ProvisioningService } from '../provisioning/provisioning.service';
import { ProvisionOrganizationDto } from '../provisioning/dto/provision-organization.dto';
import { TenantDatabaseManager } from '../tenant/tenant-database.manager';
import { TenantMigrationOrchestrator } from '../migrations/tenant-migration-orchestrator';
import { EntitlementService } from '../entitlements/entitlement.service';
import { PlatformAdminGuard, PlatformRoles } from '../identity/platform-admin.guard';
import { SubscriptionLifecycleService } from '../subscriptions/subscription-lifecycle.service';
import { CronJobsService } from '../jobs/cron-jobs.service';

/**
 * Platform Admin Controller
 *
 * Exposes endpoints for Ferio platform administration:
 * - Organization CRUD & provisioning
 * - Subscription management
 * - Plan management
 * - Tenant DB health monitoring
 * - Feature flags
 */
@ApiTags('Platform Admin')
@ApiBearerAuth()
@UseGuards(PlatformAdminGuard)
@PlatformRoles('SUPER_ADMIN', 'ADMIN')
@Controller('platform')
export class PlatformAdminController {
  constructor(
    private readonly controlPlane: ControlPlanePrismaService,
    private readonly provisioning: ProvisioningService,
    private readonly tenantDbManager: TenantDatabaseManager,
    private readonly migrationOrchestrator: TenantMigrationOrchestrator,
    private readonly entitlements: EntitlementService,
    private readonly subscriptions: SubscriptionLifecycleService,
    private readonly cronJobs: CronJobsService,
  ) {}

  // ────────────────────────────────────────────────────────────
  // Organizations
  // ────────────────────────────────────────────────────────────

  @Post('organizations')
  @ApiOperation({ summary: 'Provision a new SaaS organization' })
  async createOrganization(@Body() body: ProvisionOrganizationDto) {
    if (!body.slug || !body.name || !body.ownerUserId) {
      throw new BadRequestException('slug, name, and ownerUserId are required');
    }

    // Validate slug format
    const slugRegex = /^[a-z0-9][a-z0-9-]{2,30}[a-z0-9]$/;
    if (!slugRegex.test(body.slug.toLowerCase())) {
      throw new BadRequestException(
        'Slug must be 4-32 characters, lowercase alphanumeric with hyphens, no leading/trailing hyphens',
      );
    }

    return this.provisioning.provisionOrganization(body);
  }

  @Get('organizations')
  @ApiOperation({ summary: 'List all organizations' })
  async listOrganizations() {
    return this.controlPlane.saasOrganization.findMany({
      include: {
        database: { select: { status: true, databaseName: true, isHealthy: true } },
        subscription: { include: { plan: { select: { name: true, tier: true } } } },
        domains: { select: { domain: true, isPrimary: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Get('organizations/:id')
  @ApiOperation({ summary: 'Get organization details' })
  async getOrganization(@Param('id') id: string) {
    return this.controlPlane.saasOrganization.findUnique({
      where: { id },
      include: {
        database: true,
        subscription: { include: { plan: true, events: { orderBy: { createdAt: 'desc' }, take: 10 } } },
        domains: true,
        provisioningJobs: { orderBy: { createdAt: 'desc' }, take: 5 },
      },
    });
  }

  @Patch('organizations/:id/suspend')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Suspend an organization' })
  async suspendOrganization(@Param('id') id: string) {
    const org = await this.controlPlane.saasOrganization.update({
      where: { id },
      data: { status: 'SUSPENDED' },
    });

    await this.controlPlane.platformAuditEvent.create({
      data: {
        action: 'organization.suspended',
        actorType: 'PLATFORM_USER',
        resourceType: 'SaasOrganization',
        resourceId: id,
        organizationId: id,
      },
    });

    // Invalidate tenant connection
    await this.tenantDbManager.disconnectTenant(id);

    return org;
  }

  @Patch('organizations/:id/activate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reactivate an organization' })
  async activateOrganization(@Param('id') id: string) {
    const org = await this.controlPlane.saasOrganization.update({
      where: { id },
      data: { status: 'ACTIVE' },
    });

    await this.controlPlane.platformAuditEvent.create({
      data: {
        action: 'organization.reactivated',
        actorType: 'PLATFORM_USER',
        resourceType: 'SaasOrganization',
        resourceId: id,
        organizationId: id,
      },
    });

    return org;
  }

  // ────────────────────────────────────────────────────────────
  // Provisioning Operations (§4.6 — retry & rollback)
  // ────────────────────────────────────────────────────────────

  @Get('organizations/:id/provisioning-jobs')
  @ApiOperation({ summary: 'List provisioning attempts for an organization' })
  async listProvisioningJobs(@Param('id') id: string) {
    return this.controlPlane.provisioningJob.findMany({
      where: { organizationId: id },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Post('organizations/:id/provisioning/retry')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resume a failed provisioning pipeline (idempotent steps)' })
  async retryProvisioning(@Param('id') id: string) {
    const result = await this.provisioning.retryProvisioning(id);

    if (result.status === 'FAILED') {
      throw new BadRequestException(result.error ?? 'Provisioning failed');
    }
    return result;
  }

  @Post('organizations/:id/provisioning/rollback')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove all artifacts of a failed provisioning attempt' })
  async rollbackProvisioning(
    @Param('id') id: string,
    @Body() body: { dropPhysicalDatabase?: boolean; actorId?: string },
  ) {
    return this.provisioning.rollbackFailedProvisioning(id, {
      dropPhysicalDatabase: body?.dropPhysicalDatabase ?? false,
      actorId: body?.actorId,
    });
  }

  // ────────────────────────────────────────────────────────────
  // Tenant Schema Migrations (§4.7 Migration Orchestrator)
  // ────────────────────────────────────────────────────────────

  @Post('tenant-db/migrate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Migrate tenant databases — one, a list, or the whole fleet with bounded concurrency',
  })
  async migrateTenantDatabases(
    @Body()
    body: {
      organizationId?: string;
      organizationIds?: string[];
      all?: boolean;
      concurrency?: number;
    },
  ) {
    if (body.organizationId) {
      return this.migrationOrchestrator.migrateOne(body.organizationId);
    }
    if (body.organizationIds?.length) {
      return this.migrationOrchestrator.migrateBatch(body.organizationIds, {
        concurrency: body.concurrency,
      });
    }
    if (body.all) {
      return this.migrationOrchestrator.migrateAll({ concurrency: body.concurrency });
    }
    throw new BadRequestException(
      'Provide organizationId, organizationIds, or all:true',
    );
  }

  @Get('tenant-db')
  @ApiOperation({ summary: 'Tenant database registry state (schema versions, health)' })
  async tenantDatabaseRegistry() {
    return this.controlPlane.tenantDatabase.findMany({
      select: {
        organizationId: true,
        databaseName: true,
        status: true,
        schemaVersion: true,
        lastMigratedAt: true,
        lastHealthCheck: true,
        isHealthy: true,
        host: true,
        port: true,
      },
      orderBy: { databaseName: 'asc' },
    });
  }

  // ────────────────────────────────────────────────────────────
  // Plans
  // ────────────────────────────────────────────────────────────

  @Get('plans')
  @ApiOperation({ summary: 'List all subscription plans' })
  async listPlans() {
    return this.controlPlane.plan.findMany({
      where: { isActive: true },
      orderBy: { monthlyPriceBdt: 'asc' },
    });
  }

  @Post('plans/seed')
  @ApiOperation({ summary: 'Seed default subscription plans' })
  async seedPlans() {
    const plans = [
      {
        name: 'Free Listing',
        tier: 'FREE_LISTING' as const,
        description: 'Post property ads for free on the marketplace',
        maxUnits: 0, maxProperties: 0, maxBuildings: 0, maxStaff: 0, maxStorageMb: 50,
        monthlyPriceBdt: 0, yearlyPriceBdt: 0,
      },
      {
        name: 'Starter',
        tier: 'STARTER' as const,
        description: '5 managed units with basic rental CRM and billing',
        maxUnits: 5, maxProperties: 2, maxBuildings: 2, maxStaff: 2, maxStorageMb: 500,
        monthlyPriceBdt: 999, yearlyPriceBdt: 9990,
      },
      {
        name: 'Pro',
        tier: 'PRO' as const,
        description: '50 units with staff, utilities, maintenance, and reports',
        maxUnits: 50, maxProperties: 10, maxBuildings: 10, maxStaff: 10, maxStorageMb: 2000,
        hasUtilities: true, hasMaintenance: true, hasAdvancedReports: true,
        monthlyPriceBdt: 2999, yearlyPriceBdt: 29990,
      },
      {
        name: 'Business',
        tier: 'BUSINESS' as const,
        description: '500 units with advanced permissions, accounting, automation, and API',
        maxUnits: 500, maxProperties: 50, maxBuildings: 50, maxStaff: 50, maxStorageMb: 10000,
        hasUtilities: true, hasMaintenance: true, hasAutomation: true,
        hasApiAccess: true, hasAdvancedReports: true, hasWhatsApp: true,
        monthlyPriceBdt: 9999, yearlyPriceBdt: 99990,
      },
      {
        name: 'Enterprise',
        tier: 'ENTERPRISE' as const,
        description: 'Custom limits with dedicated support and custom domain',
        maxUnits: 99999, maxProperties: 9999, maxBuildings: 9999, maxStaff: 999, maxStorageMb: 100000,
        hasUtilities: true, hasMaintenance: true, hasAutomation: true,
        hasApiAccess: true, hasCustomDomain: true, hasWhatsApp: true, hasAdvancedReports: true,
        monthlyPriceBdt: 29999, yearlyPriceBdt: 299990,
      },
    ];

    const results: any[] = [];
    for (const plan of plans) {
      const created = await this.controlPlane.plan.upsert({
        where: { tier: plan.tier },
        create: plan,
        update: plan,
      });
      results.push(created);
    }

    return { seeded: results.length, plans: results };
  }

  @Post('plans/:planId/entitlements')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Set (upsert) a normalized plan entitlement key/value' })
  async upsertPlanEntitlement(
    @Param('planId') planId: string,
    @Body() body: { key: string; value: string },
  ) {
    if (!body.key || body.value === undefined) {
      throw new BadRequestException('key and value are required');
    }
    const row = await this.controlPlane.planEntitlement.upsert({
      where: { planId_key: { planId, key: body.key } },
      create: { planId, key: body.key, value: String(body.value) },
      update: { value: String(body.value) },
    });

    // Entitlements are cached per-org — flush on plan change.
    const subs = await this.controlPlane.subscription.findMany({
      where: { planId },
      select: { organizationId: true },
    });
    for (const s of subs) this.entitlements.invalidate(s.organizationId);

    return row;
  }

  @Get('plans/:planId/entitlements')
  @ApiOperation({ summary: 'List normalized entitlement rows for a plan' })
  async listPlanEntitlements(@Param('planId') planId: string) {
    return this.controlPlane.planEntitlement.findMany({
      where: { planId },
      orderBy: { key: 'asc' },
    });
  }

  // ────────────────────────────────────────────────────────────
  // Subscription Lifecycle (Week 8 / §15)
  // ────────────────────────────────────────────────────────────

  @Post('organizations/:id/subscription/renew')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Renew for one month (also clears PAST_DUE)' })
  async renewSubscription(@Param('id') id: string) {
    return this.subscriptions.renew(id);
  }

  @Post('organizations/:id/subscription/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel the subscription (export window per §15; DB retained)' })
  async cancelSubscription(@Param('id') id: string) {
    return this.subscriptions.cancel(id);
  }

  @Post('organizations/:id/subscription/past-due')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark subscription PAST_DUE (grace window starts)' })
  async markPastDue(@Param('id') id: string) {
    return this.subscriptions.markPastDue(id);
  }

  @Post('organizations/:id/subscription/suspend')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Suspend after grace expiry — org access blocked, DB retained' })
  async suspendSubscription(
    @Param('id') id: string,
    @Body() body: { reason?: string },
  ) {
    return this.subscriptions.suspend(id, body?.reason);
  }

  @Post('organizations/:id/subscription/reactivate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reactivate a cancelled/suspended subscription with a fresh period' })
  async reactivateSubscription(@Param('id') id: string) {
    return this.subscriptions.reactivate(id);
  }

  @Patch('organizations/:id/subscription/plan')
  @ApiOperation({ summary: 'Upgrade/downgrade plan mid-cycle (writes UPGRADED/DOWNGRADED event)' })
  async changePlan(@Param('id') id: string, @Body() body: { tier: string }) {
    if (!body?.tier) throw new BadRequestException('tier is required');
    return this.subscriptions.changePlan(id, body.tier as any);
  }

  @Post('jobs/expire-listings')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Expire public listings past their expiresAt (ops trigger for cron)' })
  async expireListings() {
    return this.cronJobs.runListingExpiryScan();
  }

  @Post('jobs/overdue-invoice-scan')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark past-due invoices OVERDUE across tenants' })
  async runOverdueScan() {
    return this.cronJobs.runOverdueInvoiceScan();
  }

  @Post('jobs/lease-expiry-scan')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Scan leases expiring within 30 days across tenants' })
  async runLeaseExpiry() {
    return this.cronJobs.runLeaseExpiryScan();
  }

  @Post('jobs/subscription-past-due-scan')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark ACTIVE subscriptions past period-end as PAST_DUE (grace starts)' })
  async runPastDueScan() {
    return this.cronJobs.runSubscriptionPastDueScan();
  }

  // ────────────────────────────────────────────────────────────
  // System Health
  // ────────────────────────────────────────────────────────────

  @Get('health')
  @ApiOperation({ summary: 'Platform health check' })
  async healthCheck() {
    const [orgCount, activeOrgs, tenantDbs] = await Promise.all([
      this.controlPlane.saasOrganization.count(),
      this.controlPlane.saasOrganization.count({ where: { status: 'ACTIVE' } }),
      this.controlPlane.tenantDatabase.findMany({
        select: { databaseName: true, status: true, isHealthy: true, organizationId: true },
      }),
    ]);

    const pool = this.tenantDbManager.getPoolStats();

    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      controlPlane: { totalOrganizations: orgCount, activeOrganizations: activeOrgs },
      tenantDatabases: {
        total: tenantDbs.length,
        ready: tenantDbs.filter((d) => d.status === 'READY').length,
        healthy: tenantDbs.filter((d) => d.isHealthy).length,
        failed: tenantDbs.filter((d) => d.status === 'FAILED').length,
      },
      connectionPool: pool,
    };
  }

  // ────────────────────────────────────────────────────────────
  // Feature Flags
  // ────────────────────────────────────────────────────────────

  @Get('feature-flags')
  @ApiOperation({ summary: 'List all feature flags' })
  async listFeatureFlags() {
    return this.controlPlane.featureFlag.findMany({
      orderBy: { key: 'asc' },
    });
  }

  @Post('feature-flags')
  @ApiOperation({ summary: 'Create or update a feature flag' })
  async upsertFeatureFlag(
    @Body() body: { key: string; description?: string; isEnabled: boolean; scopeOrganizationIds?: string[] },
  ) {
    return this.controlPlane.featureFlag.upsert({
      where: { key: body.key },
      create: {
        key: body.key,
        description: body.description,
        isEnabled: body.isEnabled,
        scopeOrganizationIds: body.scopeOrganizationIds || [],
      },
      update: {
        description: body.description,
        isEnabled: body.isEnabled,
        scopeOrganizationIds: body.scopeOrganizationIds || [],
      },
    });
  }

  // ────────────────────────────────────────────────────────────
  // Audit
  // ────────────────────────────────────────────────────────────

  @Get('audit')
  @ApiOperation({ summary: 'List platform audit events' })
  async listAuditEvents() {
    return this.controlPlane.platformAuditEvent.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
}
