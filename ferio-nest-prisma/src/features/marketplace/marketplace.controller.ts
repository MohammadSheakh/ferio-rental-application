import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Headers,
  HttpCode,
  HttpStatus,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { MarketplaceAccountService } from './marketplace-account.service';
import { MarketplaceListingService } from './marketplace-listing.service';
import { MarketplaceInteractionService } from './marketplace-interaction.service';
import {
  CreateListingDto,
  UpdateListingDto,
  AddListingMediaDto,
  AddListingDocumentDto,
  SearchListingsDto,
} from './dto/marketplace-listing.dto';
import { ListingStatus } from '@prisma/marketplace-client';
import { OptionalJwtAuthGuard } from '../../infrastructure/identity/jwt-auth.guard';
import { Identity } from '../../infrastructure/identity/identity.decorators';

@ApiTags('Marketplace')
@Controller('marketplace')
export class MarketplaceController {
  constructor(
    private readonly accountService: MarketplaceAccountService,
    private readonly listingService: MarketplaceListingService,
    private readonly interactionService: MarketplaceInteractionService,
  ) {}

  // ────────────────────────────────────────────────────────────
  // Marketplace Accounts
  // ────────────────────────────────────────────────────────────

  @Post('accounts')
  @ApiOperation({
    summary:
      'Create a public marketplace profile (individual, owner, broker, agency, developer)',
  })
  async createAccount(
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
    if (!body.centralUserId || !body.displayName) {
      throw new BadRequestException(
        'centralUserId and displayName are required',
      );
    }
    return this.accountService.createAccount(body);
  }

  @Get('accounts/me/:centralUserId')
  @ApiOperation({ summary: 'Get current user marketplace profile' })
  async getMyAccount(@Param('centralUserId') centralUserId: string) {
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
  @ApiOperation({ summary: 'Create a new property listing (enters PENDING_REVIEW when moderation is on)' })
  async createListing(
    @Param('accountId') accountId: string,
    @Body() dto: CreateListingDto,
  ) {
    return this.listingService.createListing(accountId, dto);
  }

  @Patch('accounts/:accountId/listings/:listingId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Edit listing content (re-enters review after edits when moderation is on)' })
  async updateListing(
    @Param('accountId') accountId: string,
    @Param('listingId') listingId: string,
    @Body() dto: UpdateListingDto,
  ) {
    return this.listingService.updateListing(listingId, accountId, dto);
  }

  @Post('accounts/:accountId/listings/:listingId/media')
  @ApiOperation({ summary: 'Add media (photo/video) to a listing' })
  async addMedia(
    @Param('accountId') accountId: string,
    @Param('listingId') listingId: string,
    @Body() dto: AddListingMediaDto,
  ) {
    return this.listingService.addMedia(listingId, accountId, dto);
  }

  @Post('accounts/:accountId/listings/:listingId/documents')
  @ApiOperation({ summary: 'Upload legal/sale document to a listing' })
  async addDocument(
    @Param('accountId') accountId: string,
    @Param('listingId') listingId: string,
    @Body() dto: AddListingDocumentDto,
  ) {
    return this.listingService.addDocument(listingId, accountId, dto);
  }

  @Patch('accounts/:accountId/listings/:listingId/status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update listing status (ACTIVE, PAUSED, RENTED, SOLD, ARCHIVED)',
  })
  async updateStatus(
    @Param('accountId') accountId: string,
    @Param('listingId') listingId: string,
    @Body() body: { status: ListingStatus },
  ) {
    return this.listingService.updateStatus(listingId, accountId, body.status);
  }

  // ────────────────────────────────────────────────────────────
  // Interactions (Favorites, Inquiries, Viewing Requests)
  // ────────────────────────────────────────────────────────────

  @Post('accounts/:accountId/favorites/:listingId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Toggle favorite status for a listing' })
  async toggleFavorite(
    @Param('accountId') accountId: string,
    @Param('listingId') listingId: string,
  ) {
    return this.interactionService.toggleFavorite(accountId, listingId);
  }

  @Get('accounts/:accountId/favorites')
  @ApiOperation({ summary: 'Get user favorite listings' })
  async getFavorites(@Param('accountId') accountId: string) {
    return this.interactionService.getAccountFavorites(accountId);
  }

  @Post('listings/:listingId/inquiries')
  @ApiOperation({ summary: 'Send inquiry message to listing owner' })
  async createInquiry(
    @Param('listingId') listingId: string,
    @Body()
    body: {
      senderAccountId: string;
      senderName: string;
      senderPhone?: string;
      senderEmail?: string;
      message: string;
    },
  ) {
    return this.interactionService.createInquiry({
      listingId,
      ...body,
    });
  }

  @Get('accounts/:accountId/inquiries')
  @ApiOperation({ summary: 'List account inquiries (sent and received)' })
  async getInquiries(@Param('accountId') accountId: string) {
    return this.interactionService.getInquiriesForAccount(accountId);
  }

  @Post('listings/:listingId/viewing-requests')
  @ApiOperation({ summary: 'Schedule a property viewing appointment' })
  async createViewingRequest(
    @Param('listingId') listingId: string,
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
    return this.interactionService.createViewingRequest({
      listingId,
      ...body,
    });
  }

  @Get('accounts/:accountId/viewing-requests')
  @ApiOperation({ summary: 'Get viewing appointment requests' })
  async getViewingRequests(@Param('accountId') accountId: string) {
    return this.interactionService.getViewingRequestsForAccount(accountId);
  }

  @Post('listings/:listingId/report')
  @ApiOperation({ summary: 'Report inappropriate listing' })
  async reportListing(
    @Param('listingId') listingId: string,
    @Body()
    body: { reporterAccountId: string; reason: string; details?: string },
  ) {
    return this.interactionService.createReport({
      listingId,
      ...body,
    });
  }
}
