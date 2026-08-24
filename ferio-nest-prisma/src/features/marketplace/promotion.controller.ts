import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  BadRequestException,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsIn, IsOptional, IsString, Min } from 'class-validator';
import { PromotionType, PromotionStatus } from '@prisma/marketplace-client';
import { JwtAuthGuard, OptionalJwtAuthGuard } from '../../infrastructure/identity/jwt-auth.guard';
import { PlatformAdminGuard, PlatformRoles } from '../../infrastructure/identity/platform-admin.guard';
import { Identity } from '../../infrastructure/identity/identity.decorators';
import type { Identity as IdentityType } from '../../infrastructure/identity/identity.decorators';
import { MarketplaceAccountService } from './marketplace-account.service';
import { PromotionService } from './promotion.service';

class CreatePromotionDto {
  @ApiProperty({ enum: PromotionType, example: 'FEATURED' })
  @IsEnum(PromotionType)
  type!: PromotionType;

  @ApiProperty({ enum: [7, 15, 30], example: 15 })
  @IsInt()
  @IsIn([7, 15, 30])
  durationDays!: number;
}

class ConfirmPromotionPaymentDto {
  @ApiProperty({ enum: ['BKASH', 'NAGAD', 'BANK'], example: 'BKASH' })
  @IsString()
  @IsIn(['BKASH', 'NAGAD', 'BANK'])
  paidVia!: string;

  @ApiPropertyOptional({ example: 'TRX8H2K91L' })
  @IsString()
  @IsOptional()
  paymentReference?: string;
}

class CancelPromotionDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  reason?: string;
}

/**
 * §23 Paid Listing Promotions — advertiser surface.
 *
 * Money-flow note: these endpoints only CREATE orders and report stats.
 * Activation always requires a platform-side payment confirmation — an
 * advertiser can never self-mark a promotion as paid.
 */
@ApiTags('Marketplace — Promotions')
@Controller('marketplace')
export class PromotionController {
  constructor(
    private readonly promotions: PromotionService,
    private readonly accounts: MarketplaceAccountService,
  ) {}

  private async requireAccountId(
    identity: IdentityType | null,
  ): Promise<string> {
    if (!identity?.userId) {
      throw new BadRequestException('Missing authenticated identity');
    }
    const account = await this.accounts
      .getAccountByCentralUserId(identity.userId)
      .catch(() => null);
    if (!account) {
      throw new BadRequestException(
        'No marketplace profile — complete your profile first',
      );
    }
    return account.id;
  }

  @Get('promotions/catalog')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Public pricing catalog for paid listing promotions' })
  catalog() {
    return this.promotions.catalog();
  }

  @Post('listings/:listingId/promotions')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      'Order a paid promotion on YOUR ACTIVE listing (enters PENDING_PAYMENT)',
  })
  createOrder(
    @Identity() identity: IdentityType | null,
    @Param('listingId') listingId: string,
    @Body() dto: CreatePromotionDto,
  ) {
    return this.requireAccountId(identity).then((accountId) =>
      this.promotions.createOrder(listingId, accountId, dto),
    );
  }

  @Get('listings/:listingId/promotions')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Owner: all promotions on one of my listings' })
  listForListing(
    @Identity() identity: IdentityType | null,
    @Param('listingId') listingId: string,
  ) {
    return this.requireAccountId(identity).then((accountId) =>
      this.promotions.listForListing(listingId, accountId),
    );
  }

  @Get('promotions/mine')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Advertiser: my promotions across all my listings' })
  mine(@Identity() identity: IdentityType | null) {
    return this.requireAccountId(identity).then((accountId) =>
      this.promotions.listMine(accountId),
    );
  }

  @Get('promotions/:id/stats')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Owner: inquiry performance during the promoted window',
  })
  stats(
    @Identity() identity: IdentityType | null,
    @Param('id') promotionId: string,
  ) {
    return this.requireAccountId(identity).then((accountId) =>
      this.promotions.stats(promotionId, accountId),
    );
  }

  @Post('promotions/:id/cancel')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cancel MY pending order (active promotions need support)',
  })
  cancelOwn(
    @Identity() identity: IdentityType | null,
    @Param('id') promotionId: string,
    @Body() dto: CancelPromotionDto,
  ) {
    return this.requireAccountId(identity).then((accountId) =>
      this.promotions.cancel(promotionId, { sellerAccountId: accountId, reason: dto.reason }),
    );
  }
}

/**
 * §23 platform surface — payment confirmation & lifecycle control.
 * Lives under the moderation controller's RBAC umbrella.
 */
@ApiTags('Platform Admin — Marketplace Promotions')
@ApiBearerAuth()
@UseGuards(PlatformAdminGuard)
@PlatformRoles('SUPER_ADMIN', 'ADMIN', 'SUPPORT')
@Controller('platform/marketplace/promotions')
export class PromotionAdminController {
  constructor(private readonly promotions: PromotionService) {}

  @Get()
  @ApiOperation({ summary: 'List promotions across the marketplace (filter by status)' })
  list(@Query('status') status?: PromotionStatus, @Query('limit') limit?: string) {
    const valid = status && Object.values(PromotionStatus).includes(status);
    return this.promotions.listAll(
      valid ? status : undefined,
      limit ? parseInt(limit, 10) : undefined,
    );
  }

  @Post(':id/confirm-payment')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Confirm an off-platform payment (bKash/Nagad/bank) → promotion ACTIVE for its window',
  })
  confirmPayment(
    @Identity() identity: IdentityType | null,
    @Param('id') promotionId: string,
    @Body() dto: ConfirmPromotionPaymentDto,
  ) {
    return this.promotions.confirmPayment(promotionId, identity?.userId ?? null, dto);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel any PENDING_PAYMENT or ACTIVE promotion (audited)' })
  cancelAny(
    @Identity() identity: IdentityType | null,
    @Param('id') promotionId: string,
    @Body() dto: CancelPromotionDto,
  ) {
    return this.promotions.cancel(promotionId, {
      staffId: identity?.userId ?? null,
      reason: dto.reason,
    });
  }
}
