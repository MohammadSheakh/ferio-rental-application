import { Module } from '@nestjs/common';
import { OwnerPortalService } from './owner-portal.service';
import { OwnerPortalController } from './owner-portal.controller';

/**
 * Unit Owner Portal Feature Module (§ Week 29)
 *
 * Fourth identity-bound surface: unit owners see their stake,
 * expected rent share, statements and maintenance visibility.
 */
@Module({
  controllers: [OwnerPortalController],
  providers: [OwnerPortalService],
  exports: [OwnerPortalService],
})
export class OwnerPortalModule {}
