import { Module, Global, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ControlPlanePrismaService } from './control-plane/control-plane-prisma.service';
import { MarketplacePrismaService } from './marketplace/marketplace-prisma.service';
import { TenantDatabaseManager } from './tenant/tenant-database.manager';
import { TenantResolverMiddleware } from './tenant/tenant-resolver.middleware';
import { ProvisioningService } from './provisioning/provisioning.service';
import { TenantMigrationOrchestrator } from './migrations/tenant-migration-orchestrator';
import { EntitlementService } from './entitlements/entitlement.service';
import { SubscriptionLifecycleService } from './subscriptions/subscription-lifecycle.service';
import { CronJobsService } from './jobs/cron-jobs.service';
import { PlatformAdminController } from './platform-admin/platform-admin.controller';

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
  providers: [
    ControlPlanePrismaService,
    MarketplacePrismaService,
    TenantDatabaseManager,
    TenantResolverMiddleware,
    ProvisioningService,
    TenantMigrationOrchestrator,
    EntitlementService,
    SubscriptionLifecycleService,
    CronJobsService,
  ],
  controllers: [PlatformAdminController],
  exports: [
    ControlPlanePrismaService,
    MarketplacePrismaService,
    TenantDatabaseManager,
    TenantResolverMiddleware,
    ProvisioningService,
    TenantMigrationOrchestrator,
    EntitlementService,
    SubscriptionLifecycleService,
    CronJobsService,
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
