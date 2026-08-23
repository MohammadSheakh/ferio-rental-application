import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { ListingStatus } from '@prisma/marketplace-client';
import { MarketplacePrismaService } from '../../infrastructure/marketplace/marketplace-prisma.service';

/**
 * Marketplace Moderation Service (§7 / §13)
 *
 * Trust & safety workflow: PENDING_REVIEW queue, approve/reject
 * decisions with audit metadata, and abuse-report triage.
 */
@Injectable()
export class MarketplaceModerationService {
  constructor(private readonly marketplacePrisma: MarketplacePrismaService) {}

  /** Queue of listings awaiting first approval or re-review after edits. */
  async listPendingReview(limit = 50) {
    return this.marketplacePrisma.propertyListing.findMany({
      where: { status: ListingStatus.PENDING_REVIEW },
      include: {
        seller: {
          select: {
            displayName: true,
            accountType: true,
            isIdentityVerified: true,
            verificationBadge: true,
          },
        },
        media: { where: { isCover: true }, take: 1 },
        _count: { select: { inquiries: true } },
      },
      orderBy: { updatedAt: 'asc' }, // oldest first
      take: Math.min(limit, 200),
    });
  }

  async approveListing(listingId: string, moderatorId?: string) {
    const listing = await this.marketplacePrisma.propertyListing.findUnique({
      where: { id: listingId },
      select: { status: true },
    });
    if (!listing) throw new NotFoundException('Listing not found');
    if (
      ![ListingStatus.PENDING_REVIEW, ListingStatus.REJECTED].map(String).includes(
        String(listing.status),
      )
    ) {
      throw new BadRequestException(`Listing is ${listing.status}, nothing to approve`);
    }

    return this.marketplacePrisma.propertyListing.update({
      where: { id: listingId },
      data: {
        status: ListingStatus.ACTIVE,
        publishedAt: new Date(),
        moderationDecisions: {
          create: {
            decision: 'APPROVED',
            moderatorId,
          },
        } as any,
      },
    });
  }

  async rejectListing(listingId: string, reason: string, moderatorId?: string) {
    if (!reason?.trim()) throw new BadRequestException('Rejection reason is required');

    const listing = await this.marketplacePrisma.propertyListing.findUnique({
      where: { id: listingId },
      select: { status: true },
    });
    if (!listing) throw new NotFoundException('Listing not found');
    if (String(listing.status) !== 'PENDING_REVIEW') {
      throw new BadRequestException(`Listing is ${listing.status}; only PENDING_REVIEW can be rejected`);
    }

    return this.marketplacePrisma.propertyListing.update({
      where: { id: listingId },
      data: {
        status: ListingStatus.REJECTED,
        rejectionReason: reason.slice(0, 1000),
        moderationDecisions: {
          create: {
            decision: 'REJECTED',
            reason: reason.slice(0, 1000),
            moderatorId,
          },
        } as any,
      },
    });
  }

  /** Take a listing down immediately (abuse / legal). */
  async takedownListing(listingId: string, reason: string, moderatorId?: string) {
    return this.marketplacePrisma.$transaction(async (tx) => {
      const updated = await tx.propertyListing.update({
        where: { id: listingId },
        data: {
          status: ListingStatus.ARCHIVED,
          publishedAt: null,
          moderationDecisions: {
            create: {
              decision: 'TAKEN_DOWN',
              reason: reason.slice(0, 1000),
              moderatorId,
            },
          } as any,
        },
      });

      if (reason.trim()) {
        // Leave an actionable record linking the takedown to open reports.
        await tx.moderationReport.updateMany({
          where: { listingId, status: 'PENDING' },
          data: { status: 'ACTIONED' },
        });
      }

      return updated;
    });
  }

  async listReports(status = 'PENDING', limit = 50) {
    return this.marketplacePrisma.moderationReport.findMany({
      where: { status },
      orderBy: { createdAt: 'asc' },
      take: Math.min(limit, 200),
    });
  }

  async actionReport(
    reportId: string,
    outcome: 'DISMISSED' | 'ACTIONED',
    moderatorNote?: string,
  ) {
    const report = await this.marketplacePrisma.moderationReport.findUnique({
      where: { id: reportId },
    });
    if (!report) throw new NotFoundException('Report not found');
    if (report.status === outcome) return report;

    return this.marketplacePrisma.moderationReport.update({
      where: { id: reportId },
      data: { status: outcome, details: moderatorNote ?? report.details },
    });
  }
}
