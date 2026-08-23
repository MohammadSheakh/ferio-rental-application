import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { SaleOfferStatus, ListingStatus, ListingPurpose } from '@prisma/marketplace-client';
import { MarketplacePrismaService } from '../../infrastructure/marketplace/marketplace-prisma.service';

/**
 * Sale CRM Service (§ Week 31)
 *
 * Offer/negotiation lifecycle on SALE listings:
 *   buyer offers → seller counters (or accepts/rejects)
 *   → buyer accepts counter → listing SOLD
 *
 * All transitions auditable via offer status + decidedAt; the accepted
 * amount (offer or counter) is what marks the listing SOLD.
 */
@Injectable()
export class SaleOfferService {
  constructor(private readonly marketplacePrisma: MarketplacePrismaService) {}

  private async saleListing(listingId: string) {
    const listing = await this.marketplacePrisma.propertyListing.findUnique({
      where: { id: listingId },
      include: { saleOffers: { orderBy: { createdAt: 'desc' } } },
    });
    if (!listing) throw new NotFoundException('Listing not found');
    if (listing.purpose !== ListingPurpose.SALE) {
      throw new BadRequestException('Offers apply to SALE listings only');
    }
    return listing;
  }

  /** Buyer submits an offer on an ACTIVE sale listing. */
  async createOffer(
    listingId: string,
    buyerAccountId: string,
    input: { amount: number; note?: string; brokerAccountId?: string },
  ) {
    const listing = await this.saleListing(listingId);

    if (listing.status !== ListingStatus.ACTIVE) {
      throw new BadRequestException(`Listing is ${listing.status}, not accepting offers`);
    }
    if (listing.sellerId === buyerAccountId) {
      throw new ForbiddenException('You cannot offer on your own listing');
    }
    if (input.amount <= 0) {
      throw new BadRequestException('Offer amount must be positive');
    }

    const open = listing.saleOffers.find(
      (o) => o.buyerId === buyerAccountId && o.status === SaleOfferStatus.PENDING,
    );
    if (open) {
      throw new ConflictException('You already have a pending offer — withdraw it first');
    }

    return this.marketplacePrisma.saleOffer.create({
      data: {
        listingId,
        buyerId: buyerAccountId,
        amount: input.amount,
        note: input.note,
        brokerAccountId: input.brokerAccountId,
      },
    });
  }

  /** Seller's view: all offers on their listing. */
  async listForSeller(listingId: string, sellerAccountId: string) {
    const listing = await this.saleListing(listingId);
    if (listing.sellerId !== sellerAccountId) {
      throw new ForbiddenException('Only the listing owner can view offers');
    }
    return this.marketplacePrisma.saleOffer.findMany({
      where: { listingId },
      include: {
        buyer: { select: { displayName: true, isIdentityVerified: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Buyer's view: their own offers across listings. */
  async listMine(buyerAccountId: string) {
    return this.marketplacePrisma.saleOffer.findMany({
      where: { buyerId: buyerAccountId },
      include: { listing: { select: { id: true, title: true, price: true, status: true } } },
      orderBy: { updatedAt: 'desc' },
    });
  }

  /** Seller counters a PENDING offer with a new price. */
  async counter(offerId: string, sellerAccountId: string, counterAmount: number) {
    if (counterAmount <= 0) throw new BadRequestException('Counter amount must be positive');
    return this.decide(offerId, sellerAccountId, {
      to: SaleOfferStatus.COUNTERED,
      counterAmount,
    });
  }

  /** Seller accepts outright. */
  async accept(offerId: string, sellerAccountId: string) {
    return this.decideAndSell(offerId, sellerAccountId, null);
  }

  /** Seller rejects. */
  async reject(offerId: string, sellerAccountId: string) {
    return this.decide(offerId, sellerAccountId, { to: SaleOfferStatus.REJECTED });
  }

  /** Buyer withdraws their own pending offer. */
  async withdraw(offerId: string, buyerAccountId: string) {
    const offer = await this.marketplacePrisma.saleOffer.findUnique({
      where: { id: offerId },
    });
    if (!offer) throw new NotFoundException('Offer not found');
    if (offer.buyerId !== buyerAccountId) throw new ForbiddenException('Not your offer');
    if (offer.status !== SaleOfferStatus.PENDING) {
      throw new BadRequestException(`Cannot withdraw a ${offer.status} offer`);
    }
    return this.marketplacePrisma.saleOffer.update({
      where: { id: offerId },
      data: { status: SaleOfferStatus.WITHDRAWN, decidedAt: new Date() },
    });
  }

  /**
   * Buyer accepts the seller's counter → listing SOLD at counterAmount.
   */
  async acceptCounter(offerId: string, buyerAccountId: string) {
    const offer = await this.marketplacePrisma.saleOffer.findUnique({
      where: { id: offerId },
    });
    if (!offer) throw new NotFoundException('Offer not found');
    if (offer.buyerId !== buyerAccountId) throw new ForbiddenException('Not your offer');
    if (offer.status !== SaleOfferStatus.COUNTERED) {
      throw new BadRequestException(`No open counter to accept (${offer.status})`);
    }
    return this.markSold(offer.listingId, offer.id, offer.counterAmount ?? offer.amount);
  }

  // ────────────────────────────────────────────────────────────

  private async decide(
    offerId: string,
    sellerAccountId: string,
    action: { to: SaleOfferStatus; counterAmount?: number },
  ) {
    const offer = await this.marketplacePrisma.saleOffer.findUnique({
      where: { id: offerId },
      include: { listing: { select: { sellerId: true } } },
    });
    if (!offer) throw new NotFoundException('Offer not found');
    if (offer.listing.sellerId !== sellerAccountId) {
      throw new ForbiddenException('Only the listing owner can decide offers');
    }
    if (offer.status !== SaleOfferStatus.PENDING) {
      throw new BadRequestException(`Offer already ${offer.status}`);
    }

    return this.marketplacePrisma.saleOffer.update({
      where: { id: offerId },
      data: {
        status: action.to,
        ...(action.counterAmount != null ? { counterAmount: action.counterAmount } : {}),
        decidedAt: new Date(),
      },
    });
  }

  /**
   * Accept flow shared by direct-accept and counter-accept:
   * one tx → offer ACCEPTED, sibling offers REJECTED, listing SOLD.
   */
  private async markSold(
    listingId: string,
    winningOfferId: string,
    soldAmount: number,
  ) {
    return this.marketplacePrisma.$transaction(async (tx) => {
      const accepted = await tx.saleOffer.update({
        where: { id: winningOfferId },
        data: { status: SaleOfferStatus.ACCEPTED, decidedAt: new Date() },
      });

      await tx.saleOffer.updateMany({
        where: { listingId, id: { not: winningOfferId }, status: SaleOfferStatus.PENDING },
        data: { status: SaleOfferStatus.REJECTED, decidedAt: new Date() },
      });

      const listing = await tx.propertyListing.update({
        where: { id: listingId },
        data: { status: ListingStatus.SOLD },
      });

      return { offer: accepted, soldAmount, listingStatus: listing.status };
    });
  }

  /** Shared decide-and-sell for direct acceptance at offer amount. */
  private async decideAndSell(
    offerId: string,
    sellerAccountId: string,
    _null: null,
  ) {
    const offer = await this.marketplacePrisma.saleOffer.findUnique({
      where: { id: offerId },
      include: { listing: { select: { sellerId: true } } },
    });
    if (!offer) throw new NotFoundException('Offer not found');
    if (offer.listing.sellerId !== sellerAccountId) {
      throw new ForbiddenException('Only the listing owner can decide offers');
    }
    if (offer.status !== SaleOfferStatus.PENDING) {
      throw new BadRequestException(`Offer already ${offer.status}`);
    }
    return this.markSold(offer.listingId, offer.id, offer.amount);
  }

  /**
   * Sale timeline (§ Week 31 tail): inquiries + offers + decisions
   * merged chronologically for the listing owner.
   */
  async saleTimeline(listingId: string, sellerAccountId: string) {
    const listing = await this.marketplacePrisma.propertyListing.findUnique({
      where: { id: listingId },
      select: { sellerId: true },
    });
    if (!listing) throw new NotFoundException('Listing not found');
    if (listing.sellerId !== sellerAccountId) {
      throw new ForbiddenException('Only the listing owner can view the timeline');
    }

    const [inquiries, offers] = await Promise.all([
      this.marketplacePrisma.inquiry.findMany({
        where: { listingId },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          createdAt: true,
          message: true,
          sender: { select: { displayName: true } },
        },
      }),
      this.marketplacePrisma.saleOffer.findMany({
        where: { listingId },
        orderBy: { createdAt: 'asc' },
        include: { buyer: { select: { displayName: true } } },
      }),
    ]);

    const events: Array<{
      at: string;
      type: 'INQUIRY' | 'OFFER' | 'COUNTER' | 'DECISION';
      actor: string;
      detail?: string;
    }> = [
      ...inquiries.map((i) => ({
        at: String(i.createdAt),
        type: 'INQUIRY' as const,
        actor: i.sender.displayName ?? 'buyer',
        detail: i.message?.slice(0, 120),
      })),
      ...offers.flatMap((o) => {
        const rows: Array<{
          at: string;
          type: 'OFFER' | 'COUNTER' | 'DECISION';
          actor: string;
          detail?: string;
        }> = [
          {
            at: String(o.createdAt),
            type: 'OFFER' as const,
            actor: o.buyer.displayName ?? 'buyer',
            detail: `Offer ৳${o.amount.toLocaleString()}`,
          },
        ];
        if (o.counterAmount != null && o.status === SaleOfferStatus.COUNTERED) {
          rows.push({
            at: String(o.updatedAt),
            type: 'COUNTER' as const,
            actor: 'seller',
            detail: `Counter ৳${o.counterAmount.toLocaleString()}`,
          });
        }
        if (o.decidedAt) {
          rows.push({
            at: String(o.decidedAt),
            type: 'DECISION' as const,
            actor: String(o.status).toLowerCase(),
            detail: `৳${(
              o.status === SaleOfferStatus.ACCEPTED
                ? (o.counterAmount ?? o.amount)
                : o.amount
            ).toLocaleString()}`,
          });
        }
        return rows;
      }),
    ].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

    return { listingId, events };
  }
}
