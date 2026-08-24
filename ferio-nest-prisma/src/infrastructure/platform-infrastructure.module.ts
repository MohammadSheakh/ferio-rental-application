import { Module, Global, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ControlPlanePrismaService } from './control-plane/control-plane-prisma.service';
import { MarketplacePrismaService } from './marketplace/marketplace-prisma.service';
import { TenantDatabaseManager } from './tenant/tenant-database.manager';
import { TenantResolverMiddleware } from './tenant/tenant-resolver.middleware';
import { TenantCacheService } from './tenant/tenant-cache.service';
import { ProvisioningService } from './provisioning/provisioning.service';
import { TenantMigrationOrchestrator } from './migrations/tenant-migration-orchestrator';
import { EntitlementService } from './entitlements/entitlement.service';
import { SubscriptionLifecycleService } from './subscriptions/subscription-lifecycle.service';
import { CronJobsService } from './jobs/cron-jobs.service';
import { SchedulerService } from './jobs/scheduler.service';
import { PlatformAdminController } from './platform-admin/platform-admin.controller';
import { StorageModule } from './storage/storage.module';
import { TenantOperationsModule } from '../features/tenant-operations/tenant-operations.module';
import { PlatformBillingService } from './billing/platform-billing.service';
import { ApiKeyService } from './api-external/api-key.service';
import { ExternalApiController } from './api-external/external-api.controller';
import { DomainVerificationService } from './domains/domain-verification.service';
import { TenantDbOpsService } from './tenant-db-ops/tenant-db-ops.service';

/**
 * Ferio Platform Infrastructure Module
 *
 * Global module that provides three-plane database architecture:
 *
 * 1. Control Plane (ControlPlanePrismaService)
 *    → SaaS organizations, subscriptions, tenant DB registry
 *
 * 2. Marketplace Plane (MarketplacePrismaService)
 *    → Public property listings, search, inquiries
 *
 * 3. Tenant Data Plane (TenantDatabaseManager)
 *    → Per-tenant Prisma clients via LRU connection pool
 *
 * Also provides:
 * - TenantResolverMiddleware for subdomain-based tenant resolution
 * - ProvisioningService for end-to-end organization provisioning
 * - PlatformAdminController for system management endpoints
 */
@Global()
@Module({
  imports: [StorageModule, TenantOperationsModule],
  providers: [
    ControlPlanePrismaService,
    MarketplacePrismaService,
    TenantDatabaseManager,
    TenantCacheService,
    TenantCacheService,
    TenantResolverMiddleware,
    ProvisioningService,
    TenantMigrationOrchestrator,
    EntitlementService,
    SubscriptionLifecycleService,
    CronJobsService,
    SchedulerService,
    PlatformBillingService,
    ApiKeyService,
    DomainVerificationService,
    TenantDbOpsService,
  ],
  controllers: [PlatformAdminController, ExternalApiController],
  exports: [
    ControlPlanePrismaService,
    MarketplacePrismaService,
    TenantDatabaseManager,
    TenantCacheService,
    TenantResolverMiddleware,
    ProvisioningService,
    TenantMigrationOrchestrator,
    EntitlementService,
    SubscriptionLifecycleService,
    CronJobsService,
    SchedulerService,
    PlatformBillingService,
    ApiKeyService,
    DomainVerificationService,
    TenantDbOpsService,
  ],
})
export class PlatformInfrastructureModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Apply tenant resolution middleware to tenant SaaS API routes
    // The middleware extracts the subdomain and attaches TenantContext
    consumer
      .apply(TenantResolverMiddleware)
      .forRoutes('tenant/*');
  }
}
