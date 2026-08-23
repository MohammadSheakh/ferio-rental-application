import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { MarketplacePrismaService } from '../../infrastructure/marketplace/marketplace-prisma.service';
import { TenantDatabaseManager } from '../../infrastructure/tenant/tenant-database.manager';

export interface CreateInquiryInput {
  listingId: string;
  senderAccountId: string;
  phone?: string;
  message: string;
  senderNameFallback?: string;
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
  private readonly logger = new Logger(MarketplaceInteractionService.name);

  constructor(
    private readonly marketplacePrisma: MarketplacePrismaService,
    private readonly tenantDbManager: TenantDatabaseManager,
  ) {}

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

    const inquiry = await this.marketplacePrisma.inquiry.create({
      data: {
        listingId: input.listingId,
        senderId: input.senderAccountId,
        receiverId: listing.sellerId,
        phone: input.phone,
        message: input.message,
      },
    });

    // § Week 30 attribution — best-effort, never blocks the inquiry.
    void this.attributeToOrganizationCrm(listing, input).catch((err: any) => {
      this.logger.warn(
        `CRM attribution skipped for inquiry ${inquiry.id}: ${err?.message ?? err}`,
      );
    });

    return inquiry;
  }

  /**
   * Marketplace inquiry → tenant CrmLead. Only applies to listings
   * projected from a managed unit (sourceOrganizationId + sourceUnitId).
   */
  private async attributeToOrganizationCrm(
    listing: { sourceOrganizationId: string | null; sourceUnitId: string | null },
    input: CreateInquiryInput,
  ): Promise<void> {
    if (!listing.sourceOrganizationId || !listing.sourceUnitId) return;

    const sender = await this.marketplacePrisma.marketplaceAccount.findUnique({
      where: { id: input.senderAccountId },
      select: { displayName: true, phone: true, email: true },
    });

    const db = await this.tenantDbManager.getTenantDatabase(
      listing.sourceOrganizationId,
    );
    const localUnit = await db.unit.findUnique({
      where: { id: listing.sourceUnitId },
      select: { id: true },
    });
    if (!localUnit) return;

    // Dedupe: same contact on the same unit stays one lead.
    const dupKey = input.phone ?? sender?.phone ?? null;
    const existing = await db.crmLead.findFirst({
      where: {
        source: 'MARKETPLACE_INQUIRY',
        interestedUnitId: localUnit.id,
        ...(dupKey ? { phone: dupKey } : {}),
      },
    });
    if (existing) return;

    await db.crmLead.create({
      data: {
        name:
          sender?.displayName ??
          input.senderNameFallback ??
          'Marketplace lead',
        phone: input.phone ?? sender?.phone ?? undefined,
        email: sender?.email ?? undefined,
        source: 'MARKETPLACE_INQUIRY',
        interestedUnitId: localUnit.id,
        notes: input.message,
      },
    });
    this.logger.log(
      `📥 Inquiry attributed to org ${listing.sourceOrganizationId} CRM (unit ${listing.sourceUnitId})`,
    );
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
