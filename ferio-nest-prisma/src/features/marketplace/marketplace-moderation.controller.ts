import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Req,
  HttpCode,
  HttpStatus,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { MarketplaceModerationService } from './marketplace-moderation.service';
import { Identity } from '../../infrastructure/identity/identity.decorators';
import { PlatformAdminGuard, PlatformRoles } from '../../infrastructure/identity/platform-admin.guard';

/**
 * Marketplace Moderation Controller
 *
 * Platform-moderator surface for the marketplace plane. Lives beside the
 * moderation service; routes namespaced under `platform/marketplace`.
 *
 * NOTE: moderator identity is taken from `x-actor-id` until the §10
 * platform-auth guard lands on these routes.
 */
@ApiTags('Platform Admin — Marketplace Moderation')
@ApiBearerAuth()
@UseGuards(PlatformAdminGuard)
@PlatformRoles('SUPER_ADMIN', 'ADMIN', 'MODERATOR')
@Controller('platform/marketplace')
export class MarketplaceModerationController {
  constructor(private readonly moderation: MarketplaceModerationService) {}

  @Get('listings/pending-review')
  @ApiOperation({ summary: 'List listings awaiting review (oldest first)' })
  async listPending(@Query('limit') limit?: string) {
    return this.moderation.listPendingReview(limit ? parseInt(limit, 10) : undefined);
  }

  @Post('listings/:listingId/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve a listing → ACTIVE (publishes it)' })
  async approve(
    @Identity() identity: { userId: string } | null,
    @Param('listingId') listingId: string,
  ) {
    return this.moderation.approveListing(listingId, identity?.userId);
  }

  @Post('listings/:listingId/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reject a listing with a required reason' })
  async reject(
    @Identity() identity: { userId: string } | null,
    @Param('listingId') listingId: string,
    @Body() body: { reason: string },
  ) {
    if (!body?.reason?.trim()) throw new BadRequestException('reason is required');
    return this.moderation.rejectListing(listingId, body.reason, identity?.userId);
  }

  @Post('listings/:listingId/takedown')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Immediately archive a live listing (abuse/legal) and action open reports' })
  async takedown(
    @Identity() identity: { userId: string } | null,
    @Param('listingId') listingId: string,
    @Body() body: { reason?: string },
  ) {
    return this.moderation.takedownListing(listingId, body?.reason ?? '', identity?.userId);
  }

  @Get('reports')
  @ApiOperation({ summary: 'List abuse reports by status (default PENDING)' })
  async listReports(
    @Query('status') status?: string,
    @Query('limit') limit?: string,
  ) {
    return this.moderation.listReports(
      status ?? 'PENDING',
      limit ? parseInt(limit, 10) : undefined,
    );
  }

  @Post('reports/:reportId/action')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resolve a report as ACTIONED or DISMISSED' })
  async actionReport(
    @Param('reportId') reportId: string,
    @Body() body: { outcome: 'DISMISSED' | 'ACTIONED'; note?: string },
  ) {
    if (!['DISMISSED', 'ACTIONED'].includes(body?.outcome)) {
      throw new BadRequestException("outcome must be 'DISMISSED' or 'ACTIONED'");
    }
    return this.moderation.actionReport(reportId, body.outcome, body.note);
  }
}
