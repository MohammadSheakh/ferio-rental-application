import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import {
  PromotionType,
  PromotionStatus,
  ListingStatus,
} from '@prisma/marketplace-client';
import { MarketplacePrismaService } from '../../infrastructure/marketplace/marketplace-prisma.service';
import { ControlPlanePrismaService } from '../../infrastructure/control-plane/control-plane-prisma.service';

/** Rank weight per promotion type — higher wins within the same sort bucket. */
export const PROMOTION_TIER: Record<PromotionType, number> = {
  URGENT: 1,
  FEATURED: 2,
  TOP_SEARCH: 3,
};

const ALLOWED_DURATIONS = [7, 15, 30] as const;

/**
 * §23 pricing (BDT). Environment-overridable as
 * `PROMO_PRICE_<TYPE>_<DAYS>_BDT`, e.g. PROMO_PRICE_FEATURED_30_BDT=3500.
 */
function priceFor(type: PromotionType, days: number): number {
  const envKey = `PROMO_PRICE_${type}_${days}_BDT`;
  if (process.env[envKey]) return Number(process.env[envKey]);
  const table: Record<PromotionType, Record<number, number>> = {
    FEATURED: { 7: 800, 15: 1500, 30: 2800 },
    URGENT: { 7: 500, 15: 900, 30: 1700 },
    TOP_SEARCH: { 7: 1200, 15: 2200, 30: 4000 },
  };
  return table[type][days];
}

const PAID_VIA = ['BKASH', 'NAGAD', 'BANK'] as const;

/**
 * §23 Paid Listing Promotions — Advertiser → Ferio revenue stream.
 *
 * This is a SEPARATE money domain from rent and SaaS subscriptions
 * (§11): it lives entirely in the marketplace plane and only records
 * manually-confirmed MFS/bank payments.
 */
@Injectable()
export class PromotionService {
  private readonly logger = new Logger(PromotionService.name);

  constructor(
    private readonly marketplacePrisma: MarketplacePrismaService,
    private readonly controlPlane: ControlPlanePrismaService,
  ) {}

  catalog() {
    return {
      currency: 'BDT',
      products: (Object.keys(PROMOTION_TIER) as PromotionType[]).map((type) => ({
        type,
        rankWeight: PROMOTION_TIER[type],
        durations: ALLOWED_DURATIONS.map((days) => ({
          days,
          priceBdt: priceFor(type, days),
        })),
      })),
    };
  }

  /**
   * Advertiser creates an order on THEIR OWN listing. Moderation interlock:
   * only ACTIVE listings can be promoted; one open order per type.
   */
  async createOrder(
    listingId: string,
    sellerAccountId: string,
    dto: { type: PromotionType; durationDays: number },
  ) {
    const listing = await this.marketplacePrisma.propertyListing.findUnique({
      where: { id: listingId },
      select: { id: true, sellerId: true, status: true, title: true },
    });
    if (!listing) throw new NotFoundException('Property listing not found');
    if (listing.sellerId !== sellerAccountId) {
      throw new ForbiddenException('You do not own this listing');
    }
    if (listing.status !== ListingStatus.ACTIVE) {
      throw new BadRequestException(
        `Only ACTIVE listings can be promoted (current: ${listing.status})`,
      );
    }
    if (!(ALLOWED_DURATIONS as readonly number[]).includes(dto.durationDays)) {
      throw new BadRequestException('durationDays must be 7, 15 or 30');
    }

    const open = await this.marketplacePrisma.listingPromotion.findFirst({
      where: {
        listingId,
        type: dto.type,
        status: { in: [PromotionStatus.PENDING_PAYMENT, PromotionStatus.ACTIVE] },
      },
      select: { id: true },
    });
    if (open) {
      throw new BadRequestException(
        `An ${dto.type} promotion for this listing already exists (${open.id}) — renew after it completes`,
      );
    }

    const amountBdt = priceFor(dto.type, dto.durationDays);
    const promo = await this.marketplacePrisma.listingPromotion.create({
      data: {
        listingId,
        type: dto.type,
        status: PromotionStatus.PENDING_PAYMENT,
        amountBdt,
        durationDays: dto.durationDays,
      },
    });

    await this.audit(
      'marketplace.promotion.ordered',
      promo.id,
      { listingId, type: dto.type, amountBdt, durationDays: dto.durationDays },
    ).catch(() => {});
    return promo;
  }

  /** Advertiser view: all promotions across their own listings. */
  async listMine(sellerAccountId: string) {
    return this.marketplacePrisma.listingPromotion.findMany({
      where: { listing: { sellerId: sellerAccountId } },
      include: { listing: { select: { id: true, title: true, status: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  /** Owner-only promotions list for one listing. */
  async listForListing(listingId: string, sellerAccountId: string) {
    const listing = await this.marketplacePrisma.propertyListing.findUnique({
      where: { id: listingId },
      select: { sellerId: true },
    });
    if (!listing) throw new NotFoundException('Property listing not found');
    if (listing.sellerId !== sellerAccountId) {
      throw new ForbiddenException('You do not own this listing');
    }
    return this.marketplacePrisma.listingPromotion.findMany({
      where: { listingId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Platform staff confirms an off-platform payment → promotion becomes
   * ACTIVE for its window and the listing's denormalized ranking fields
   * are refreshed. Advertisers can never self-activate (§23 security).
   */
  async confirmPayment(
    promotionId: string,
    staffId: string | null | undefined,
    dto: { paidVia: string; paymentReference?: string },
  ) {
    if (!PAID_VIA.includes(dto.paidVia as (typeof PAID_VIA)[number])) {
      throw new BadRequestException(`paidVia must be one of ${PAID_VIA.join(', ')}`);
    }
    const promo = await this.marketplacePrisma.listingPromotion.findUnique({
      where: { id: promotionId },
    });
    if (!promo) throw new NotFoundException('Promotion not found');
    if (promo.status !== PromotionStatus.PENDING_PAYMENT) {
      throw new BadRequestException(
        `Only PENDING_PAYMENT promotions can be confirmed (current: ${promo.status})`,
      );
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + promo.durationDays * 86_400_000);

    const updated = await this.marketplacePrisma.$transaction(async (tx) => {
      const row = await tx.listingPromotion.update({
        where: { id: promotionId },
        data: {
          status: PromotionStatus.ACTIVE,
          startsAt: now,
          expiresAt,
          paidAt: now,
          paidVia: dto.paidVia,
          paymentReference: dto.paymentReference ?? null,
          decidedBy: staffId ?? null,
        },
      });
      // Interlock re-check happens inside refresh — a listing that fell
      // out of ACTIVE between order and payment yields no ranking boost.
      await this.refreshListingPromoState(promo.listingId, tx);
      return row;
    });

    await this.audit('marketplace.promotion.activated', promotionId, {
      listingId: promo.listingId,
      type: promo.type,
      paidVia: dto.paidVia,
      amountBdt: promo.amountBdt,
      expiresAt: expiresAt.toISOString(),
      staffId: staffId ?? null,
    }).catch(() => {});
    return updated;
  }

  /**
   * Cancel: advertisers may cancel their own PENDING_PAYMENT orders;
   * platform staff may cancel PENDING_PAYMENT or ACTIVE orders.
   */
  async cancel(
    promotionId: string,
    actor: { sellerAccountId?: string; staffId?: string | null; reason?: string },
  ) {
    const promo = await this.marketplacePrisma.listingPromotion.findUnique({
      where: { id: promotionId },
      include: { listing: { select: { sellerId: true } } },
    });
    if (!promo) throw new NotFoundException('Promotion not found');

    const isPlatformStaff = !!actor.staffId;
    if (!isPlatformStaff) {
      if (promo.listing.sellerId !== actor.sellerAccountId) {
        throw new ForbiddenException('You do not own this promotion');
      }
      if (promo.status === PromotionStatus.ACTIVE) {
        throw new BadRequestException(
          'Active promotions cannot be self-cancelled — contact Ferio support',
        );
      }
    }
    if (
      promo.status !== PromotionStatus.PENDING_PAYMENT &&
      promo.status !== PromotionStatus.ACTIVE
    ) {
      throw new BadRequestException(
        `Cannot cancel a promotion in ${promo.status} state`,
      );
    }

    const updated = await this.marketplacePrisma.$transaction(async (tx) => {
      const row = await tx.listingPromotion.update({
        where: { id: promotionId },
        data: {
          status: PromotionStatus.CANCELLED,
          decidedBy: isPlatformStaff ? actor.staffId! : promo.decidedBy,
          cancelReason:
            actor.reason ??
            (isPlatformStaff
              ? 'Cancelled by platform'
              : 'Cancelled by advertiser'),
        },
      });
      await this.refreshListingPromoState(promo.listingId, tx);
      return row;
    });

    await this.audit('marketplace.promotion.cancelled', promotionId, {
      listingId: promo.listingId,
      by: isPlatformStaff ? 'platform' : 'advertiser',
      reason: actor.reason ?? null,
    }).catch(() => {});
    return updated;
  }

  /**
   * Expiry scan (cron / platform job trigger): flip past-window ACTIVE
   * promotions to EXPIRED and rebuild each affected listing's ranking
   * fields from whatever remains active.
   */
  async expireScan() {
    const now = new Date();
    const expired = await this.marketplacePrisma.listingPromotion.findMany({
      where: { status: PromotionStatus.ACTIVE, expiresAt: { lt: now } },
      select: { id: true, listingId: true },
    });
    if (!expired.length) return { expired: 0, listingsAffected: 0 };

    const listingIds = [...new Set(expired.map((p) => p.listingId))];
    await this.marketplacePrisma.listingPromotion.updateMany({
      where: { id: { in: expired.map((p) => p.id) } },
      data: { status: PromotionStatus.EXPIRED },
    });
    for (const listingId of listingIds) {
      await this.refreshListingPromoState(listingId);
    }
    this.logger.log(
      `⏰ Promotion expiry scan: ${expired.length} expired across ${listingIds.length} listings`,
    );
    return { expired: expired.length, listingsAffected: listingIds.length };
  }

  /** Performance stats for one promotion (owner-only). */
  async stats(promotionId: string, sellerAccountId: string) {
    const promo = await this.marketplacePrisma.listingPromotion.findUnique({
      where: { id: promotionId },
      include: { listing: { select: { sellerId: true, title: true } } },
    });
    if (!promo) throw new NotFoundException('Promotion not found');
    if (promo.listing.sellerId !== sellerAccountId) {
      throw new ForbiddenException('You do not own this promotion');
    }

    const windowStart = promo.startsAt ?? promo.createdAt;
    const windowEnd = promo.expiresAt ?? new Date();
    const [inquiriesInWindow, totalInquiries] = await Promise.all([
      this.marketplacePrisma.inquiry.count({
        where: {
          listingId: promo.listingId,
          createdAt: { gte: windowStart, lte: windowEnd },
        },
      }),
      this.marketplacePrisma.inquiry.count({
        where: { listingId: promo.listingId },
      }),
    ]);
    return {
      promotion: {
        id: promo.id,
        type: promo.type,
        status: promo.status,
        amountBdt: promo.amountBdt,
        startsAt: promo.startsAt,
        expiresAt: promo.expiresAt,
      },
      listingTitle: promo.listing.title,
      inquiriesInWindow,
      totalInquiries,
    };
  }

  /** Platform surface: promotions across the marketplace. */
  async listAll(status?: PromotionStatus, limit = 100) {
    return this.marketplacePrisma.listingPromotion.findMany({
      where: status ? { status } : undefined,
      include: {
        listing: {
          select: { id: true, title: true, status: true, sellerId: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 500),
    });
  }

  /**
   * Recompute a listing's denormalized promotion state (tier / badges /
   * promotedUntil) from its currently-ACTIVE promotions. Idempotent —
   * safe to call after every transition. Accepts an optional transaction
   * client so callers can keep transition + refresh atomic.
   */
  private async refreshListingPromoState(
    listingId: string,
    tx?: Pick<MarketplacePrismaService, 'listingPromotion' | 'propertyListing'>,
  ) {
    const db = tx ?? this.marketplacePrisma;
    const active = await db.listingPromotion.findMany({
      where: {
        listingId,
        status: PromotionStatus.ACTIVE,
        expiresAt: { gt: new Date() },
      },
      select: { type: true, expiresAt: true },
    });

    const tier = active.reduce((max, p) => Math.max(max, PROMOTION_TIER[p.type]), 0);
    const badges = [...new Set(active.map((p) => p.type as string))];
    const until = active.reduce<Date | null>(
      (latest, p) =>
        !latest || (p.expiresAt && p.expiresAt > latest) ? p.expiresAt : latest,
      null,
    );

    return db.propertyListing.update({
      where: { id: listingId },
      data: {
        promotionTier: tier,
        promotionBadges: badges,
        promotedUntil: until,
      },
      select: {
        id: true,
        promotionTier: true,
        promotionBadges: true,
        promotedUntil: true,
      },
    });
  }

  private audit(action: string, resourceId: string, metadata: Record<string, unknown>) {
    return this.controlPlane.platformAuditEvent.create({
      data: {
        action,
        actorType: 'SYSTEM',
        resourceType: 'ListingPromotion',
        resourceId,
        metadata: metadata as any,
      },
    });
  }
}
