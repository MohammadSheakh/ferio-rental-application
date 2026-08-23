import { Module } from '@nestjs/common';
import { MarketplaceAccountService } from './marketplace-account.service';
import { MarketplaceListingService } from './marketplace-listing.service';
import { MarketplaceInteractionService } from './marketplace-interaction.service';
import { MarketplaceModerationService } from './marketplace-moderation.service';
import { MarketplaceController } from './marketplace.controller';
import { MarketplaceModerationController } from './marketplace-moderation.controller';

/**
 * Central Marketplace Feature Module
 *
 * Provides services and controllers for:
 * - Public marketplace accounts (INDIVIDUAL, OWNER, BROKER, AGENCY, DEVELOPER)
 * - Property listings (RENT, SALE) for apartments, shops, offices, warehouses, land
 * - OpenStreetMap & geospatial location search
 * - Inquiries, favorites, viewing appointments, and moderation reporting
 * - Trust & safety: PENDING_REVIEW queue, approve/reject/takedown, report triage (§7/§13)
 */
@Module({
  controllers: [MarketplaceController, MarketplaceModerationController],
  providers: [
    MarketplaceAccountService,
    MarketplaceListingService,
    MarketplaceInteractionService,
    MarketplaceModerationService,
  ],
  exports: [
    MarketplaceAccountService,
    MarketplaceListingService,
    MarketplaceInteractionService,
    MarketplaceModerationService,
  ],
})
export class MarketplaceModule {}
