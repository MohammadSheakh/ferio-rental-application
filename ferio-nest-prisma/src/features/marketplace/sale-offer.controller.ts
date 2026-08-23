import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { JwtAuthGuard } from '../../infrastructure/identity/jwt-auth.guard';
import { Identity } from '../../infrastructure/identity/identity.decorators';
import type { Identity as IdentityType } from '../../infrastructure/identity/identity.decorators';
import { SaleOfferService } from './sale-offer.service';
import { MarketplaceAccountService } from './marketplace-account.service';

class CreateOfferDto {
  @IsNumber() @Min(1)
  amount!: number;

  @IsOptional() @IsString()
  note?: string;

  /** Optional broker attribution (marketplace account id of broker). */
  @IsOptional() @IsString()
  brokerAccountId?: string;
}

class CounterDto {
  @IsNumber() @Min(1)
  amount!: number;
}

/**
 * Sale CRM endpoints (§ Week 31) — offer/negotiation lifecycle on
 * SALE listings. All routes require an authenticated marketplace identity.
 */
@ApiTags('Marketplace — Sale Offers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('marketplace')
export class SaleOfferController {
  constructor(
    private readonly offers: SaleOfferService,
    private readonly accounts: MarketplaceAccountService,
  ) {}

  private async accountId(identity: IdentityType | null): Promise<string> {
    if (!identity?.userId) throw new BadRequestException('Missing authenticated identity');
    const account = await this.accounts
      .getAccountByCentralUserId(identity.userId)
      .catch(() => null);
    if (!account) {
      throw new BadRequestException('No marketplace profile — complete your profile first');
    }
    return account.id;
  }

  @Post('listings/:listingId/offers')
  async createOffer(
    @Identity() identity: IdentityType | null,
    @Param('listingId') listingId: string,
    @Body() dto: CreateOfferDto,
  ) {
    const buyerId = await this.accountId(identity);
    return this.offers.createOffer(listingId, buyerId, dto);
  }

  @Get('listings/:listingId/offers')
  @ApiOperation({ summary: 'Seller: all offers on my sale listing' })
  async listForSeller(
    @Identity() identity: IdentityType | null,
    @Param('listingId') listingId: string,
  ) {
    const sellerId = await this.accountId(identity);
    return this.offers.listForSeller(listingId, sellerId);
  }

  @Get('offers/mine')
  @ApiOperation({ summary: 'Buyer: my offers across listings' })
  async mine(@Identity() identity: IdentityType | null) {
    const buyerId = await this.accountId(identity);
    return this.offers.listMine(buyerId);
  }

  @Post('offers/:offerId/counter')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Seller counters a pending offer' })
  async counter(
    @Identity() identity: IdentityType | null,
    @Param('offerId') offerId: string,
    @Body() dto: CounterDto,
  ) {
    const sellerId = await this.accountId(identity);
    return this.offers.counter(offerId, sellerId, dto.amount);
  }

  @Post('offers/:offerId/accept')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Seller accepts → listing SOLD at offer amount; siblings rejected' })
  async accept(
    @Identity() identity: IdentityType | null,
    @Param('offerId') offerId: string,
  ) {
    const sellerId = await this.accountId(identity);
    return this.offers.accept(offerId, sellerId);
  }

  @Post('offers/:offerId/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Seller rejects the offer' })
  async reject(
    @Identity() identity: IdentityType | null,
    @Param('offerId') offerId: string,
  ) {
    const sellerId = await this.accountId(identity);
    return this.offers.reject(offerId, sellerId);
  }

  @Post('offers/:offerId/withdraw')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Buyer withdraws their own pending offer' })
  async withdraw(
    @Identity() identity: IdentityType | null,
    @Param('offerId') offerId: string,
  ) {
    const buyerId = await this.accountId(identity);
    return this.offers.withdraw(offerId, buyerId);
  }

  @Post('offers/:offerId/accept-counter')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Buyer accepts the counter → listing SOLD at counterAmount' })
  async acceptCounter(
    @Identity() identity: IdentityType | null,
    @Param('offerId') offerId: string,
  ) {
    const buyerId = await this.accountId(identity);
    return this.offers.acceptCounter(offerId, buyerId);
  }
}
