import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Patch,
  Query,
  Res,
  HttpCode,
  HttpStatus,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import type { Response } from 'express';
import { ControlPlanePrismaService } from '../control-plane/control-plane-prisma.service';
import { ProvisioningService } from '../provisioning/provisioning.service';
import { ProvisionOrganizationDto } from '../provisioning/dto/provision-organization.dto';
import { TenantDatabaseManager } from '../tenant/tenant-database.manager';
import { TenantResolverMiddleware } from '../tenant/tenant-resolver.middleware';
import { TenantMigrationOrchestrator } from '../migrations/tenant-migration-orchestrator';
import { EntitlementService } from '../entitlements/entitlement.service';
import { PlatformAdminGuard, PlatformRoles, CurrentStaff } from '../identity/platform-admin.guard';
import type { StaffPayload } from '../identity/platform-admin.guard';
import { SubscriptionLifecycleService } from '../subscriptions/subscription-lifecycle.service';
import { CronJobsService } from '../jobs/cron-jobs.service';
import { MarketplacePrismaService } from '../marketplace/marketplace-prisma.service';
import { Prisma } from '@prisma/marketplace-client';
import { PlatformBillingService } from '../billing/platform-billing.service';
import {
  ApiKeyService,
  API_SCOPES,
} from '../api-external/api-key.service';
import { TenantDbOpsService } from '../tenant-db-ops/tenant-db-ops.service';
import { PaymentsService } from '../payments/payments.service';

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
    private readonly marketplacePrisma: MarketplacePrismaService,
    private readonly platformBilling: PlatformBillingService,
    private readonly apiKeys: ApiKeyService,
    private readonly dbOps: TenantDbOpsService,
    private readonly resolver: TenantResolverMiddleware,
    private readonly payments: PaymentsService,
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
    this.resolver.clearCache();

    this.controlPlane.platformAuditEvent.create({
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
    this.resolver.clearCache();

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

  @Post('jobs/rent-reminders')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '§ Week 22 emit rent.reminder webhooks for invoices due within N days' })
  async rentReminders() {
    return this.cronJobs.runRentReminderScan(3);
  }

  @Post('jobs/maintenance-escalation')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '§ Week 22 escalate stale maintenance tickets one urgency level' })
  async maintenanceEscalation() {
    return this.cronJobs.runMaintenanceEscalationScan(3);
  }

  @Post('payments/:id/refulfill')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '§ P1 complete a PAID intent whose fulfillment failed' })
  async refulfillPayment(@Param('id') id: string) {
    const intent = await this.payments.getStatus(id);
    if (intent.status !== 'PAID' || intent.fulfilledAt) {
      throw new BadRequestException('Intent is not awaiting fulfillment');
    }
    return this.payments.refulfillPending();
  }

  @Post('jobs/refulfill-payments')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '§ P1 sweep PAID intents missing fulfillment' })
  async sweepFulfillments() {
    return this.payments.refulfillPending();
  }

  @Post('jobs/retention-sweep')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '§ P2 delete expired search events + delivered webhook log rows' })
  async retentionSweep() {
    return this.cronJobs.runRetentionSweep();
  }

  @Get('ops/alerts')
  @ApiOperation({ summary: '§ P0 observability — aggregated failure signals needing operator attention' })
  async opsAlerts() {
    const [failedLedgerPosts, deadOutbox, failedWebhooks, failedIntents, provisioningFailed] =
      await Promise.all([
        this.controlPlane.platformAuditEvent.count({ where: { action: 'ledger.post_failed' } }),
        this.tenantDeadOutbox(),
        this.marketplaceWebhookFailures(),
        this.controlPlane.paymentIntent.count({
          where: { status: 'PAID', fulfilledAt: null },
        }),
        this.controlPlane.saasOrganization.count({ where: { status: 'PROVISIONING_FAILED' } }),
      ]);
    const alerts = [
      failedLedgerPosts > 0 && `ledger.post_failed × ${failedLedgerPosts}`,
      deadOutbox > 0 && `outbox dead-letter × ${deadOutbox}`,
      failedWebhooks > 0 && `webhook deliveries FAILED × ${failedWebhooks}`,
      failedIntents > 0 && `PAID intents awaiting fulfillment × ${failedIntents}`,
      provisioningFailed > 0 && `PROVISIONING_FAILED orgs × ${provisioningFailed}`,
    ].filter(Boolean);
    return {
      healthy: alerts.length === 0,
      alerts,
      counts: { failedLedgerPosts, deadOutbox, failedWebhooks, failedIntents, provisioningFailed },
    };
  }

  /** § P0 observability — dead-letter outbox events across ACTIVE tenants. */
  private async tenantDeadOutbox(): Promise<number> {
    const orgs = await this.controlPlane.saasOrganization.findMany({
      where: { status: 'ACTIVE', database: { status: 'READY' } },
      select: { id: true },
    });
    let n = 0;
    for (const o of orgs) {
      try {
        const db = await this.tenantDbManager.getTenantDatabase(o.id);
        n += await db.tenantOutboxEvent.count({ where: { status: 'FAILED' } });
      } catch {
        /* skip unreachable */
      }
    }
    return n;
  }

  private async marketplaceWebhookFailures(): Promise<number> {
    // webhook deliveries live per-tenant; count across ACTIVE orgs
    const orgs = await this.controlPlane.saasOrganization.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true },
    });
    let n = 0;
    for (const o of orgs) {
      try {
        const db = await this.tenantDbManager.getTenantDatabase(o.id);
        n += await db.webhookDelivery.count({ where: { status: 'FAILED' } });
      } catch {
        /* skip */
      }
    }
    return n;
  }

  @Post('jobs/generate-monthly-statements')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '§ Week 22 create current-period statements for all billed units (idempotent)' })
  async generateStatements() {
    return this.cronJobs.runMonthlyStatementScan();
  }

  @Post('jobs/expire-promotions')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '§23 expire paid promotions past their window (badge/rank removal)' })
  async expirePromotions() {
    return this.cronJobs.runPromotionExpiryScan();
  }

  // ────────────────────────────────────────────────────────────
  // § Week 27 Platform Billing (Organization → Ferio)
  // ────────────────────────────────────────────────────────────

  @Get('billing/invoices')
  @ApiOperation({ summary: 'Platform subscription invoices (filter by org/status)' })
  async listInvoices(
    @Query('organizationId') organizationId?: string,
    @Query('status') status?: 'DUE' | 'PAID' | 'VOID',
  ) {
    return this.platformBilling.listInvoices(organizationId, status as any);
  }

  @Post('billing/invoices/:id/payments')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Confirm an off-platform subscription payment → invoice PAID when covered',
  })
  async recordPayment(
    @CurrentStaff() staff: StaffPayload,
    @Param('id') invoiceId: string,
    @Body() body: { method: string; amountBdt?: number; reference?: string },
  ) {
    if (!body?.method) throw new BadRequestException('method is required');
    return this.platformBilling.recordPayment(invoiceId, body, staff?.sub ?? staff?.userId ?? null);
  }

  // ────────────────────────────────────────────────────────────
  // § Week 33 External API keys
  // ────────────────────────────────────────────────────────────

  @Post('organizations/:id/api-keys')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      'Issue an API key for an organization — the full key is returned ONCE (scopes default to all read scopes)',
  })
  async createApiKey(
    @Param('id') id: string,
    @Body()
    body: { name: string; scopes?: string[]; createdBy?: string },
  ) {
    if (!body?.name) throw new BadRequestException('name is required');
    return this.apiKeys.createKey(id, body);
  }

  @Get('api-keys/scopes')
  @ApiOperation({ summary: 'List valid API key scopes' })
  listScopes() {
    return { scopes: API_SCOPES };
  }

  @Get('api-keys')
  @ApiOperation({ summary: 'List issued API keys (filter by org)' })
  async listApiKeys(@Query('organizationId') organizationId?: string) {
    return this.apiKeys.listKeys(organizationId);
  }

  @Post('api-keys/:id/rotate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate an API key — new secret issued once, old revoked immediately' })
  async rotateApiKey(
    @CurrentStaff() staff: StaffPayload,
    @Param('id') id: string,
  ) {
    return this.apiKeys.rotate(id, staff?.sub ?? staff?.userId ?? null);
  }

  @Post('api-keys/:id/revoke')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke an API key immediately' })
  async revokeApiKey(@Param('id') id: string) {
    return this.apiKeys.revoke(id);
  }

  // ────────────────────────────────────────────────────────────
  // § Week 36 Tenant DB Operations
  // ────────────────────────────────────────────────────────────

  @Post('organizations/:id/backups')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Take a physical pg_dump backup of the tenant DB → storage' })
  async createBackup(
    @Param('id') id: string,
    @Body() body: { type?: string; note?: string },
    @CurrentStaff() staff: StaffPayload,
  ) {
    return this.dbOps.createBackup(id, {
      type: body?.type,
      note: body?.note,
      createdBy: staff?.sub ?? staff?.userId ?? null,
    });
  }

  @Get('organizations/:id/backups')
  @ApiOperation({ summary: 'List backups for one organization' })
  async listOrgBackups(@Param('id') id: string) {
    return this.dbOps.listBackups(id);
  }

  @Get('backups')
  @ApiOperation({ summary: 'List all tenant backups (newest first)' })
  async listBackups(@Query('organizationId') organizationId?: string) {
    return this.dbOps.listBackups(organizationId);
  }

  @Post('backups/:id/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Prove the archive is readable (pg_restore --list)' })
  async verifyBackup(@Param('id') id: string) {
    return this.dbOps.verifyBackup(id);
  }

  @Post('backups/:id/clone')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Clone-to-staging — restore into a fresh standalone database' })
  async cloneBackup(@Param('id') id: string) {
    return this.dbOps.cloneFromBackup(id);
  }

  @Post('organizations/:id/archive')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Archive: tenant DB DISABLED + connections dropped (resolver locks out)' })
  async archiveOrg(@Param('id') id: string) {
    return this.dbOps.setArchived(id, true);
  }

  @Post('organizations/:id/unarchive')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Un-archive: tenant DB back to READY' })
  async unarchiveOrg(@Param('id') id: string) {
    return this.dbOps.setArchived(id, false);
  }

  @Get('organizations/:id/export')
  @ApiOperation({ summary: '§ Week 36 data-portability export — org operational data as JSON' })
  async exportOrg(@Param('id') id: string, @Res() res: Response) {
    const payload = await this.dbOps.exportOrganization(id);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="ferio-export-${payload.organization.slug}.json"`,
    );
    res.end(JSON.stringify(payload));
  }

  @Get('tenant-db/metrics')
  @ApiOperation({ summary: 'Connection pool stats + database fleet status + backup totals' })
  async dbMetrics() {
    return this.dbOps.metrics();
  }

  @Post('jobs/generate-subscription-invoices')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Create missing period invoices for all ACTIVE subscriptions' })
  async generateSubscriptionInvoices() {
    return this.platformBilling.generateDueInvoices();
  }

  @Get('analytics')
  @ApiOperation({ summary: 'Platform analytics — orgs, MRR, listings, conversion' })
  async platformAnalytics() {
    const orgs = await this.controlPlane.saasOrganization.findMany({
      select: {
        status: true,
        subscription: { select: { plan: { select: { tier: true, monthlyPriceBdt: true } } } },
      },
    });
    const plans = await this.controlPlane.plan.findMany({ where: { isActive: true } });
    const listings = await this.marketplacePrisma.propertyListing.groupBy({
      by: ['purpose', 'status'],
      _count: { _all: true },
    });
    const inquiryCount = await this.marketplacePrisma.inquiry.count();
    const offerCount = await this.marketplacePrisma.saleOffer.count();

    // §23 promotion revenue — only actually-paid promotions count.
    const paidPromotions = await this.marketplacePrisma.listingPromotion.findMany({
      where: { status: { in: ['ACTIVE', 'EXPIRED'] } },
      select: { type: true, amountBdt: true, paidAt: true },
    });
    const promoByType = new Map<string, { count: number; amountBdt: number }>();
    const promoByMonth = new Map<string, number>();
    let promoRevenueBdt = 0;
    for (const p of paidPromotions) {
      promoRevenueBdt += p.amountBdt;
      const t = promoByType.get(p.type) ?? { count: 0, amountBdt: 0 };
      promoByType.set(p.type, { count: t.count + 1, amountBdt: t.amountBdt + p.amountBdt });
      if (p.paidAt) {
        const month = p.paidAt.toISOString().slice(0, 7);
        promoByMonth.set(month, (promoByMonth.get(month) ?? 0) + p.amountBdt);
      }
    }

    const activeOrgs = orgs.filter((o) => o.status === 'ACTIVE').length;
    const mrr = orgs.reduce((sum, o) => {
      const price = (o as any).subscription?.plan?.monthlyPriceBdt ?? 0;
      return sum + ((o as any).subscription?.status === 'ACTIVE' ? price : 0);
    }, 0);

    const listingCounts = new Map<string, number>();
    for (const l of listings) {
      const key = `${l.purpose.toLowerCase()}_${l.status.toLowerCase()}`;
      listingCounts.set(key, l._count._all);
    }
    const totalListings = [...listingCounts.values()].reduce((a, b) => a + b, 0);

    return {
      organizations: {
        total: orgs.length,
        active: activeOrgs,
      },
      mrrBdt: mrr,
      listings: {
        total: totalListings,
        byStatus: Object.fromEntries(listingCounts),
        inquiryCount: inquiryCount,
        saleOfferCount: offerCount,
        inquiryConversionPercent:
          inquiryCount > 0 ? Number(((offerCount / inquiryCount) * 100).toFixed(1)) : 0,
      },
      activePlans: plans.map((p) => ({ tier: p.tier, name: p.name, monthlyPriceBdt: p.monthlyPriceBdt })),
      promotions: {
        paidCount: paidPromotions.length,
        revenueBdt: Math.round(promoRevenueBdt * 100) / 100,
        byType: Object.fromEntries(promoByType),
        byMonth: Object.fromEntries([...promoByMonth.entries()].sort()),
      },
      // § Weeks 34–35 platform analytics
      subscriptionConversion: {
        totalOrgs: orgs.length,
        paidTierOrgs: activeOrgs,
        percent:
          orgs.length > 0
            ? Number(((activeOrgs / orgs.length) * 100).toFixed(1))
            : 0,
      },
    };
  }

  /**
   * § Weeks 34–35 Marketplace analytics — listing volume & type trends,
   * area demand (inquiries + search pressure), price ranges, search
   * activity. All read-only aggregations over the central projection.
   */
  @Get('analytics/marketplace')
  @ApiOperation({ summary: 'Marketplace analytics — volume, trends, area demand, ranges, search activity' })
  async marketplaceAnalytics() {
    const listings = await this.marketplacePrisma.propertyListing.findMany({
      select: {
        purpose: true, assetType: true, price: true, area: true,
        createdAt: true, status: true,
      },
    });

    const monthKey = (d: Date) => d.toISOString().slice(0, 7);
    const volumeByMonth = new Map<string, number>();
    const typeTrends = new Map<string, Map<string, number>>();
    const ranges = new Map<string, { purpose: string; prices: number[] }>();
    let active = 0;

    for (const l of listings) {
      if (l.status === 'ACTIVE' || l.status === 'RENTED' || l.status === 'SOLD') active++;
      const mk = monthKey(l.createdAt);
      volumeByMonth.set(mk, (volumeByMonth.get(mk) ?? 0) + 1);

      const tKey = `${mk}|${l.assetType}`;
      const byMonth =
        typeTrends.get(l.assetType) ?? new Map<string, number>();
      typeTrends.set(l.assetType, byMonth);
      byMonth.set(mk, (byMonth.get(mk) ?? 0) + 1);

      if (l.status === 'ACTIVE') {
        const rKey = l.assetType;
        const bucket = ranges.get(rKey) ?? { purpose: l.purpose, prices: [] };
        bucket.prices.push(l.price);
        ranges.set(rKey, bucket);
      }
    }

    const percentile = (arr: number[], p: number) => {
      if (!arr.length) return null;
      const s = [...arr].sort((a, b) => a - b);
      const idx = Math.min(s.length - 1, Math.floor((p / 100) * s.length));
      return Math.round(s[idx]);
    };

    const priceRanges = [...ranges.entries()].map(([type, b]) => ({
      assetType: type,
      purpose: b.purpose,
      count: b.prices.length,
      min: percentile(b.prices, 0),
      median: percentile(b.prices, 50),
      max: percentile(b.prices, 100),
    }));

    const areaDemand = await this.marketplacePrisma.inquiry.groupBy({
      by: ['listingId'],
      _count: { _all: true },
    });
    void areaDemand; // inquiries→area requires join; computed via raw SQL below

    const demandRows = await this.marketplacePrisma.$queryRaw<
      Array<{ area: string | null; inquiries: bigint }>
    >(Prisma.sql`
      SELECT l."area", COUNT(i."id")::bigint AS inquiries
      FROM "Inquiry" i JOIN "PropertyListing" l ON l."id" = i."listingId"
      GROUP BY l."area" ORDER BY inquiries DESC LIMIT 10
    `);

    const searchPressure = await this.marketplacePrisma.$queryRaw<
      Array<{ area: string | null; searches: bigint }>
    >(Prisma.sql`
      SELECT "area", COUNT(*)::bigint AS searches
      FROM "SearchEvent"
      WHERE "createdAt" > now() - interval '30 days' AND "area" IS NOT NULL
      GROUP BY "area" ORDER BY searches DESC LIMIT 10
    `);

    const searchWeekly = await this.marketplacePrisma.$queryRaw<
      Array<{ week: string; count: bigint }>
    >(Prisma.sql`
      SELECT to_char(date_trunc('week', "createdAt"), 'YYYY-MM-DD') AS week,
             COUNT(*)::bigint AS count
      FROM "SearchEvent"
      WHERE "createdAt" > now() - interval '8 weeks'
      GROUP BY 1 ORDER BY 1
    `);

    const trendOut: Record<string, Record<string, number>> = {};
    for (const [type, byMonth] of typeTrends) {
      trendOut[type] = Object.fromEntries([...byMonth.entries()].sort());
    }

    return {
      totals: { all: listings.length, activeOrTransacted: active },
      listingVolumeByMonth: Object.fromEntries([...volumeByMonth.entries()].sort()),
      propertyTypeTrends: trendOut,
      priceRanges,
      areaDemand: demandRows.map((r) => ({
        area: r.area ?? 'unknown',
        inquiries: Number(r.inquiries),
      })),
      searchActivity: {
        topAreasLast30d: searchPressure.map((r) => ({
          area: r.area ?? 'unknown',
          searches: Number(r.searches),
        })),
        weekly: searchWeekly.map((r) => ({ week: r.week, count: Number(r.count) })),
      },
    };
  }

  /** § Weeks 34–35 growth/churn snapshot for the control plane. */
  @Get('analytics/growth')
  @ApiOperation({ summary: 'Tenant DB growth + subscription churn snapshot' })
  async growthAnalytics() {
    const dbs = await this.controlPlane.tenantDatabase.findMany({
      select: { createdAt: true, status: true },
    });
    const byMonth = new Map<string, number>();
    for (const db of dbs) {
      const mk = db.createdAt.toISOString().slice(0, 7);
      byMonth.set(mk, (byMonth.get(mk) ?? 0) + 1);
    }

    const cutoff = new Date(Date.now() - 30 * 86_400_000);
    const [cancelledLast30d, activeCount] = await Promise.all([
      this.controlPlane.subscriptionEvent.count({
        where: { eventType: 'CANCELLED', createdAt: { gte: cutoff } },
      }),
      this.controlPlane.subscription.count({ where: { status: 'ACTIVE' } }),
    ]);

    return {
      tenantDbGrowthByMonth: Object.fromEntries([...byMonth.entries()].sort()),
      tenantDbsTotal: dbs.length,
      churn: {
        cancelledLast30d,
        activeSubscriptions: activeCount,
        churnRatePercent:
          activeCount + cancelledLast30d > 0
            ? Number(
                (
                  (cancelledLast30d / (activeCount + cancelledLast30d)) *
                  100
                ).toFixed(1),
              )
            : 0,
      },
    };
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
