import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Headers,
  HttpCode,
  HttpStatus,
  BadRequestException,
  ForbiddenException,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import { MarketplaceAccountService } from './marketplace-account.service';
import { MarketplaceListingService } from './marketplace-listing.service';
import { MarketplaceInteractionService } from './marketplace-interaction.service';
import {
  CreateListingDto,
  UpdateListingDto,
  AddListingMediaDto,
  AddListingDocumentDto,
  AddListingRoomDto,
  UpdateListingRoomDto,
  SearchListingsDto,
  MapSearchDto,
} from './dto/marketplace-listing.dto';
import { ListingStatus } from '@prisma/marketplace-client';
import { JwtAuthGuard, OptionalJwtAuthGuard } from '../../infrastructure/identity/jwt-auth.guard';
import { Identity } from '../../infrastructure/identity/identity.decorators';

@ApiTags('Marketplace')
@Controller('marketplace')
export class MarketplaceController {
  constructor(
    private readonly accountService: MarketplaceAccountService,
    private readonly listingService: MarketplaceListingService,
    private readonly interactionService: MarketplaceInteractionService,
  ) {}

  private async assertOwnAccount(centralUserId: string, accountId: string) {
    const account = await this.accountService.getAccountByCentralUserId(centralUserId);
    if (account.id !== accountId) {
      throw new ForbiddenException('Marketplace account does not belong to this identity');
    }
  }

  // ────────────────────────────────────────────────────────────
  // Marketplace Accounts
  // ────────────────────────────────────────────────────────────

  @Post('accounts')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary:
      'Create a public marketplace profile (individual, owner, broker, agency, developer)',
  })
  async createAccount(
    @Identity() identity: { userId: string },
    @Body()
    body: {
      centralUserId: string;
      accountType?: any;
      displayName: string;
      phone?: string;
      email?: string;
      avatarUrl?: string;
      bio?: string;
    },
  ) {
    if (!body.displayName) {
      throw new BadRequestException(
        'displayName is required',
      );
    }
    if (body.centralUserId && body.centralUserId !== identity.userId) {
      throw new ForbiddenException('Cannot create an account for another identity');
    }
    return this.accountService.createAccount({ ...body, centralUserId: identity.userId });
  }

  @Get('accounts/me/:centralUserId')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get current user marketplace profile' })
  async getMyAccount(
    @Param('centralUserId') centralUserId: string,
    @Identity() identity: { userId: string },
  ) {
    if (centralUserId !== identity.userId) {
      throw new ForbiddenException('Cannot read another identity account');
    }
    return this.accountService.getAccountByCentralUserId(centralUserId);
  }

  @Get('accounts/:id')
  @ApiOperation({ summary: 'Get public profile by account ID' })
  async getPublicAccount(@Param('id') id: string) {
    return this.accountService.getAccountById(id);
  }

  // ────────────────────────────────────────────────────────────
  // Listings (Public Search & Management)
  // ────────────────────────────────────────────────────────────

  @Get('listings/search')
  @ApiOperation({
    summary:
      'Search public property listings (rent & sale) with filters, geo radius/bounds & pagination',
  })
  async searchListings(@Query() query: SearchListingsDto) {
    return this.listingService.searchListings(query);
  }

  @Get('listings/spotlight')
  @ApiOperation({
    summary: '§23 homepage spotlight — listings with a live TOP_SEARCH promotion',
  })
  async spotlight(@Query('limit') limit?: string) {
    return this.listingService.spotlight(limit ? parseInt(limit, 10) : undefined);
  }

  @Get('listings/map')
  @ApiOperation({
    summary:
      'Map viewport search — lightweight markers for OpenStreetMap rendering',
  })
  async mapSearch(@Query() query: MapSearchDto) {
    return this.listingService.mapSearch(query);
  }

  @Get('listings/:id')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({
    summary:
      'Detailed property listing — sale documents filtered by the authenticated viewer\'s visibility rules',
  })
  async getListing(@Param('id') id: string, @Identity() identity: { userId: string } | null) {
    // Resolve the viewer's marketplace profile (if any) so document
    // visibility rules (VERIFIED_USERS / INTERESTED_BUYERS / PRIVATE)
    // can be applied server-side.
    let accountId: string | undefined;
    if (identity?.userId) {
      const account = await this.accountService
        .getAccountByCentralUserId(identity.userId)
        .catch(() => null);
      accountId = account?.id;
    }
    return this.listingService.getListingById(id, { accountId });
  }

  @Post('accounts/:accountId/listings')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Create a new property listing (enters PENDING_REVIEW when moderation is on)' })
  async createListing(
    @Param('accountId') accountId: string,
    @Identity() identity: { userId: string },
    @Body() dto: CreateListingDto,
  ) {
    await this.assertOwnAccount(identity.userId, accountId);
    return this.listingService.createListing(accountId, dto);
  }

  @Patch('accounts/:accountId/listings/:listingId')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Edit listing content (re-enters review after edits when moderation is on)' })
  async updateListing(
    @Param('accountId') accountId: string,
    @Param('listingId') listingId: string,
    @Identity() identity: { userId: string },
    @Body() dto: UpdateListingDto,
  ) {
    await this.assertOwnAccount(identity.userId, accountId);
    return this.listingService.updateListing(listingId, accountId, dto);
  }

  @Post('accounts/:accountId/listings/:listingId/media')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Add media (photo/video) to a listing' })
  async addMedia(
    @Param('accountId') accountId: string,
    @Param('listingId') listingId: string,
    @Identity() identity: { userId: string },
    @Body() dto: AddListingMediaDto,
  ) {
    await this.assertOwnAccount(identity.userId, accountId);
    return this.listingService.addMedia(listingId, accountId, dto);
  }

  @Post('accounts/:accountId/listings/:listingId/documents')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Upload legal/sale document to a listing' })
  async addDocument(
    @Param('accountId') accountId: string,
    @Param('listingId') listingId: string,
    @Identity() identity: { userId: string },
    @Body() dto: AddListingDocumentDto,
  ) {
    await this.assertOwnAccount(identity.userId, accountId);
    return this.listingService.addDocument(listingId, accountId, dto);
  }

  @Patch('accounts/:accountId/listings/:listingId/status')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update listing status (ACTIVE, PAUSED, RENTED, SOLD, ARCHIVED)',
  })
  async updateStatus(
    @Param('accountId') accountId: string,
    @Param('listingId') listingId: string,
    @Identity() identity: { userId: string },
    @Body() body: { status: ListingStatus },
  ) {
    await this.assertOwnAccount(identity.userId, accountId);
    return this.listingService.updateStatus(listingId, accountId, body.status);
  }

  // ────────────────────────────────────────────────────────────
  // §24 Room-by-room detail (seller-managed listings)
  // ────────────────────────────────────────────────────────────

  @Post('accounts/:accountId/listings/:listingId/rooms')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Add a room (name/type/feet dimensions/photos) to my listing' })
  async addRoom(
    @Param('accountId') accountId: string,
    @Param('listingId') listingId: string,
    @Identity() identity: { userId: string },
    @Body() dto: AddListingRoomDto,
  ) {
    await this.assertOwnAccount(identity.userId, accountId);
    return this.listingService.addRoom(listingId, accountId, dto);
  }

  @Patch('accounts/:accountId/listings/:listingId/rooms/:roomId')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Edit a room on my listing' })
  async updateRoom(
    @Param('accountId') accountId: string,
    @Param('listingId') listingId: string,
    @Param('roomId') roomId: string,
    @Identity() identity: { userId: string },
    @Body() dto: UpdateListingRoomDto,
  ) {
    await this.assertOwnAccount(identity.userId, accountId);
    return this.listingService.updateRoom(listingId, accountId, roomId, dto);
  }

  @Delete('accounts/:accountId/listings/:listingId/rooms/:roomId')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Remove a room from my listing' })
  async deleteRoom(
    @Param('accountId') accountId: string,
    @Param('listingId') listingId: string,
    @Param('roomId') roomId: string,
    @Identity() identity: { userId: string },
  ) {
    await this.assertOwnAccount(identity.userId, accountId);
    return this.listingService.deleteRoom(listingId, accountId, roomId);
  }

  @Post('accounts/:accountId/listings/:listingId/rooms/:roomId/media')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Register a photo against a specific room' })
  async addRoomMedia(
    @Param('accountId') accountId: string,
    @Param('listingId') listingId: string,
    @Param('roomId') roomId: string,
    @Identity() identity: { userId: string },
    @Body() body: { url: string; caption?: string; sortOrder?: number },
  ) {
    if (!body?.url) throw new BadRequestException('url is required');
    await this.assertOwnAccount(identity.userId, accountId);
    return this.listingService.addRoomMedia(listingId, accountId, roomId, body);
  }

  @Delete('accounts/:accountId/listings/:listingId/room-media/:mediaId')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Remove a room photo registration' })
  async deleteRoomMedia(
    @Param('accountId') accountId: string,
    @Param('listingId') listingId: string,
    @Param('mediaId') mediaId: string,
    @Identity() identity: { userId: string },
  ) {
    await this.assertOwnAccount(identity.userId, accountId);
    return this.listingService.deleteRoomMedia(listingId, accountId, mediaId);
  }

  // ────────────────────────────────────────────────────────────
  // Interactions (Favorites, Inquiries, Viewing Requests)
  // ────────────────────────────────────────────────────────────

  @Post('accounts/:accountId/favorites/:listingId')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Toggle favorite status for a listing' })
  async toggleFavorite(
    @Param('accountId') accountId: string,
    @Param('listingId') listingId: string,
    @Identity() identity: { userId: string },
  ) {
    await this.assertOwnAccount(identity.userId, accountId);
    return this.interactionService.toggleFavorite(accountId, listingId);
  }

  @Get('accounts/:accountId/favorites')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get user favorite listings' })
  async getFavorites(
    @Param('accountId') accountId: string,
    @Identity() identity: { userId: string },
  ) {
    await this.assertOwnAccount(identity.userId, accountId);
    return this.interactionService.getAccountFavorites(accountId);
  }

  @Post('listings/:listingId/inquiries')
  @UseGuards(JwtAuthGuard, ThrottlerGuard)
  @Throttle({ default: { limit: Number(process.env.INQUIRY_RATE_LIMIT || 30), ttl: 3_600_000 } })
  @ApiOperation({ summary: 'Send inquiry message to listing owner (rate limited, default 30/hour)' })
  async createInquiry(
    @Param('listingId') listingId: string,
    @Identity() identity: { userId: string },
    @Body()
    body: {
      senderAccountId: string;
      senderName: string;
      senderPhone?: string;
      senderEmail?: string;
      message: string;
    },
  ) {
    await this.assertOwnAccount(identity.userId, body.senderAccountId);
    return this.interactionService.createInquiry({
      listingId,
      ...body,
    });
  }

  @Get('accounts/:accountId/inquiries')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'List account inquiries (sent and received)' })
  async getInquiries(
    @Param('accountId') accountId: string,
    @Identity() identity: { userId: string },
  ) {
    await this.assertOwnAccount(identity.userId, accountId);
    return this.interactionService.getInquiriesForAccount(accountId);
  }

  @Post('listings/:listingId/viewing-requests')
  @UseGuards(JwtAuthGuard, ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 3_600_000 } })
  @ApiOperation({ summary: 'Schedule a property viewing appointment (rate limited: 10/hour)' })
  async createViewingRequest(
    @Param('listingId') listingId: string,
    @Identity() identity: { userId: string },
    @Body()
    body: {
      requesterAccountId: string;
      requesterName: string;
      requesterPhone: string;
      requestedDate: string;
      requestedTimeSlot?: string;
      notes?: string;
    },
  ) {
    await this.assertOwnAccount(identity.userId, body.requesterAccountId);
    return this.interactionService.createViewingRequest({
      listingId,
      ...body,
    });
  }

  @Get('accounts/:accountId/viewing-requests')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get viewing appointment requests' })
  async getViewingRequests(
    @Param('accountId') accountId: string,
    @Identity() identity: { userId: string },
  ) {
    await this.assertOwnAccount(identity.userId, accountId);
    return this.interactionService.getViewingRequestsForAccount(accountId);
  }

  @Post('listings/:listingId/report')
  @UseGuards(JwtAuthGuard, ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 3_600_000 } })
  @ApiOperation({ summary: 'Report inappropriate listing (rate limited: 5/hour)' })
  async reportListing(
    @Param('listingId') listingId: string,
    @Identity() identity: { userId: string },
    @Body()
    body: { reporterAccountId: string; reason: string; details?: string },
  ) {
    await this.assertOwnAccount(identity.userId, body.reporterAccountId);
    return this.interactionService.createReport({
      listingId,
      ...body,
    });
  }
}
