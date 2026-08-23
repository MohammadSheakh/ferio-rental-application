import { Module } from '@nestjs/common';
import { TenantPropertyService } from './tenant-property.service';
import { TenantLeaseService } from './tenant-lease.service';
import { TenantBillingService } from './tenant-billing.service';
import { TenantUtilityService } from './tenant-utility.service';
import { TenantMaintenanceService } from './tenant-maintenance.service';
import { TenantReportingService } from './tenant-reporting.service';
import { TenantOutboxService } from './outbox/tenant-outbox.service';
import { MarketplaceProjectionWorker } from './outbox/marketplace-projection.worker';
import { TenantCrmService } from './tenant-crm.service';
import { TenantCrmController } from './tenant-crm.controller';
import { TenantIamService } from './tenant-iam.service';
import { TenantIamController } from './tenant-iam.controller';
import { MarketplaceProjectionService } from './marketplace-projection.service';
import { ProjectionOpsController } from './projection-ops.controller';
import { TenantOperationsController } from './tenant-operations.controller';
import { MarketplaceModule } from '../marketplace/marketplace.module';

/**
 * Tenant Operations Feature Module
 *
 * Senior 10+ Year Architecture Scope:
 * - Isolated SaaS property, building & unit management
 * - Multi-unit owner percentage split routing
 * - Transactional outbox + projection worker (§8 cross-plane events)
 * - Renter NID verification & lease lifecycle management
 * - Multi-beneficiary billing (unit owner rent, building management service charge, utility providers)
 * - Utility meter reading & allocation (DESCO, DPDC, WASA, Titas)
 * - Maintenance request triage & vendor work order tracking
 * - Executive analytics & operational reporting engine
 */
@Module({
  imports: [MarketplaceModule],
  controllers: [
    TenantOperationsController,
    ProjectionOpsController,
    TenantIamController,
  ],
  providers: [
    TenantPropertyService,
    TenantLeaseService,
    TenantBillingService,
    TenantUtilityService,
    TenantMaintenanceService,
    TenantReportingService,
    TenantIamService,
    TenantCrmService,
    TenantOutboxService,
    MarketplaceProjectionWorker,
    MarketplaceProjectionService,
  ],
  exports: [
    TenantPropertyService,
    TenantLeaseService,
    TenantBillingService,
    TenantUtilityService,
    TenantMaintenanceService,
    TenantReportingService,
    TenantIamService,
    TenantCrmService,
    TenantOutboxService,
    MarketplaceProjectionWorker,
    MarketplaceProjectionService,
  ],
})
export class TenantOperationsModule {}
