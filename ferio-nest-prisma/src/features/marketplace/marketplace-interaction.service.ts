import { Injectable, NotFoundException } from '@nestjs/common';
import { MarketplacePrismaService } from '../../infrastructure/marketplace/marketplace-prisma.service';

export interface CreateInquiryInput {
  listingId: string;
  senderAccountId: string;
  phone?: string;
  message: string;
}

export interface CreateViewingRequestInput {
  listingId: string;
  requesterAccountId: string;
  requestedDate: string;
  phone?: string;
  message?: string;
}

export interface CreateReportInput {
  listingId: string;
  reporterAccountId: string;
  reason: string;
  details?: string;
}

@Injectable()
export class MarketplaceInteractionService {
  constructor(private readonly marketplacePrisma: MarketplacePrismaService) {}

  // ────────────────────────────────────────────────────────────
  // Favorites
  // ────────────────────────────────────────────────────────────

  async toggleFavorite(accountId: string, listingId: string) {
    const existing = await this.marketplacePrisma.favorite.findUnique({
      where: { accountId_listingId: { accountId, listingId } },
    });

    if (existing) {
      await this.marketplacePrisma.favorite.delete({
        where: { id: existing.id },
      });
      return { favorited: false };
    } else {
      await this.marketplacePrisma.favorite.create({
        data: { accountId, listingId },
      });
      return { favorited: true };
    }
  }

  async getAccountFavorites(accountId: string) {
    return this.marketplacePrisma.favorite.findMany({
      where: { accountId },
      include: {
        listing: {
          include: {
            seller: { select: { displayName: true, isIdentityVerified: true } },
            media: { where: { isCover: true }, take: 1 },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ────────────────────────────────────────────────────────────
  // Inquiries
  // ────────────────────────────────────────────────────────────

  async createInquiry(input: CreateInquiryInput) {
    const listing = await this.marketplacePrisma.propertyListing.findUnique({
      where: { id: input.listingId },
    });

    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    return this.marketplacePrisma.inquiry.create({
      data: {
        listingId: input.listingId,
        senderId: input.senderAccountId,
        receiverId: listing.sellerId,
        phone: input.phone,
        message: input.message,
      },
    });
  }

  async getInquiriesForAccount(accountId: string) {
    return this.marketplacePrisma.inquiry.findMany({
      where: {
        OR: [{ senderId: accountId }, { receiverId: accountId }],
      },
      include: {
        listing: { select: { id: true, title: true } },
        sender: { select: { displayName: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ────────────────────────────────────────────────────────────
  // Viewing Requests
  // ────────────────────────────────────────────────────────────

  async createViewingRequest(input: CreateViewingRequestInput) {
    const listing = await this.marketplacePrisma.propertyListing.findUnique({
      where: { id: input.listingId },
    });

    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    return this.marketplacePrisma.viewingRequest.create({
      data: {
        listingId: input.listingId,
        requesterId: input.requesterAccountId,
        preferredDate: new Date(input.requestedDate),
        phone: input.phone,
        message: input.message,
      },
    });
  }

  async getViewingRequestsForAccount(accountId: string) {
    return this.marketplacePrisma.viewingRequest.findMany({
      where: {
        requesterId: accountId,
      },
      include: {
        listing: {
          select: { id: true, title: true, address: true, area: true },
        },
      },
      orderBy: { preferredDate: 'asc' },
    });
  }

  // ────────────────────────────────────────────────────────────
  // Moderation Reports
  // ────────────────────────────────────────────────────────────

  async createReport(input: CreateReportInput) {
    return this.marketplacePrisma.moderationReport.create({
      data: {
        listingId: input.listingId,
        reporterId: input.reporterAccountId,
        reason: input.reason,
        details: input.details,
      },
    });
  }
}
