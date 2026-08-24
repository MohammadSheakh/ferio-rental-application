import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { MarketplaceAccountService } from './marketplace-account.service';
import { MarketplaceListingService } from './marketplace-listing.service';
import { MarketplaceInteractionService } from './marketplace-interaction.service';
import { MarketplaceModerationService } from './marketplace-moderation.service';
import { SaleOfferService } from './sale-offer.service';
import { PromotionService } from './promotion.service';
import { MarketplaceController } from './marketplace.controller';
import { MarketplaceModerationController } from './marketplace-moderation.controller';
import { SaleOfferController } from './sale-offer.controller';
import { PromotionController, PromotionAdminController } from './promotion.controller';
import { MarketplaceUploadController } from './upload.controller';

/**
 * Central Marketplace Feature Module
 *
 * Provides services and controllers for:
 * - Public marketplace accounts (INDIVIDUAL, OWNER, BROKER, AGENCY, DEVELOPER)
 * - Property listings (RENT, SALE) for apartments, shops, offices, warehouses, land
 * - OpenStreetMap & geospatial location search
 * - Inquiries, favorites, viewing appointments, and moderation reporting
 * - Trust & safety: PENDING_REVIEW queue, approve/reject/takedown, report triage (§7/§13)
 * - §23 paid listing promotions (Advertiser → Ferio revenue stream)
 * - §24 room-by-room rich listing detail
 */
@Module({
  imports: [
    // §13 anti-spam: per-route ThrottlerGuard limits on contact endpoints.
    ThrottlerModule.forRoot([{ ttl: 3_600_000, limit: 100 }]),
  ],
  controllers: [
    MarketplaceController,
    MarketplaceModerationController,
    SaleOfferController,
    PromotionController,
    PromotionAdminController,
    MarketplaceUploadController,
  ],
  providers: [
    MarketplaceAccountService,
    MarketplaceListingService,
    MarketplaceInteractionService,
    MarketplaceModerationService,
    SaleOfferService,
    PromotionService,
  ],
  exports: [
    MarketplaceAccountService,
    MarketplaceListingService,
    MarketplaceInteractionService,
    MarketplaceModerationService,
    SaleOfferService,
    PromotionService,
  ],
})
export class MarketplaceModule {}
