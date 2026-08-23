import {
  Controller,
  Get,
  Post,
  UseGuards,
  Body,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { PaymentMethod } from '@prisma/tenant-client';
import { JwtAuthGuard } from '../../infrastructure/identity/jwt-auth.guard';
import { Identity } from '../../infrastructure/identity/identity.decorators';
import type { Identity as IdentityType } from '../../infrastructure/identity/identity.decorators';
import { RenterPortalService } from './renter-portal.service';

class ReportPaymentDto {
  @IsString()
  invoiceId!: string;

  @IsEnum(PaymentMethod)
  method!: PaymentMethod;

  @IsNumber()
  @Min(1)
  amount!: number;

  @IsOptional()
  @IsString()
  reference?: string;

  @IsOptional()
  @IsString()
  proofUrl?: string;
}

/**
 * Renter Portal (§ Week 28) — the fourth surface.
 * Authenticated renters see their tenancy, statements, beneficiary
 * payment instructions and report payments for staff verification.
 */
@ApiTags('Renter Portal')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('renter')
export class RenterPortalController {
  constructor(private readonly portal: RenterPortalService) {}

  @Get('me')
  @ApiOperation({ summary: 'Tenancy snapshot — lease, unit, beneficiaries, outstanding' })
  async me(@Identity() identity: IdentityType | null) {
    return this.portal.me(this.require(identity));
  }

  @Get('invoices')
  @ApiOperation({ summary: 'Monthly statements for the rented unit (incl. receipts)' })
  async invoices(@Identity() identity: IdentityType | null) {
    return this.portal.listInvoices(this.require(identity));
  }

  @Get('utilities')
  @ApiOperation({ summary: 'Utility accounts, meters and latest readings for the rented unit' })
  async utilities(@Identity() identity: IdentityType | null) {
    return this.portal.listUtilities(this.require(identity));
  }

  @Get('maintenance')
  @ApiOperation({ summary: 'Maintenance tickets for the rented unit' })
  async maintenance(@Identity() identity: IdentityType | null) {
    return this.portal.listMaintenance(this.require(identity));
  }

  @Post('maintenance')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Report a UNIT-scoped maintenance issue (enters triage as OPEN)' })
  async createMaintenance(
    @Identity() identity: IdentityType | null,
    @Body()
    body: {
      title: string;
      description?: string;
      urgency?: 'EMERGENCY' | 'URGENT' | 'NORMAL' | 'LOW';
      photoUrls?: string[];
    },
  ) {
    if (!body?.title?.trim()) throw new BadRequestException('title is required');
    return this.portal.createMaintenance(this.require(identity), body);
  }

  @Get('notices')
  @ApiOperation({ summary: 'Announcements for this tenancy (org-wide + unit)' })
  async notices(@Identity() identity: IdentityType | null) {
    return this.portal.listNotices(this.require(identity));
  }

  @Get('documents')
  @ApiOperation({ summary: 'Lease & unit documents shared with the renter' })
  async documents(@Identity() identity: IdentityType | null) {
    return this.portal.listDocuments(this.require(identity));
  }

  @Post('payments')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Report a payment made directly to the owner/beneficiary' })
  async reportPayment(@Identity() identity: IdentityType | null, @Body() dto: ReportPaymentDto) {
    return this.portal.reportPayment(this.require(identity), dto);
  }

  private require(identity: IdentityType | null): string {
    if (!identity?.userId) throw new BadRequestException('Missing authenticated identity');
    return identity.userId;
  }
}
