import { Module } from '@nestjs/common';
import { RenterPortalService } from './renter-portal.service';
import { RenterPortalController } from './renter-portal.controller';
import { TenantOperationsModule } from '../tenant-operations/tenant-operations.module';

/**
 * Renter Portal Feature Module (§ Week 28)
 *
 * Fourth surface: authenticated renters of managed units.
 */
@Module({
  imports: [TenantOperationsModule],
  controllers: [RenterPortalController],
  providers: [RenterPortalService],
  exports: [RenterPortalService],
})
export class RenterPortalModule {}
