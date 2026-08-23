import { Module } from '@nestjs/common';
import { MarketplaceAccountService } from './marketplace-account.service';
import { MarketplaceListingService } from './marketplace-listing.service';
import { MarketplaceInteractionService } from './marketplace-interaction.service';
import { MarketplaceModerationService } from './marketplace-moderation.service';
import { SaleOfferService } from './sale-offer.service';
import { MarketplaceController } from './marketplace.controller';
import { MarketplaceModerationController } from './marketplace-moderation.controller';
import { SaleOfferController } from './sale-offer.controller';

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
  controllers: [MarketplaceController, MarketplaceModerationController, SaleOfferController],
  providers: [
    MarketplaceAccountService,
    MarketplaceListingService,
    MarketplaceInteractionService,
    MarketplaceModerationService,
    SaleOfferService,
  ],
  exports: [
    MarketplaceAccountService,
    MarketplaceListingService,
    MarketplaceInteractionService,
    MarketplaceModerationService,
    SaleOfferService,
  ],
})
export class MarketplaceModule {}
