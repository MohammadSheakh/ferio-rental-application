import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Query,
  Param,
  Req,
  BadRequestException,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CrmLeadStatus, CrmLeadSource } from '@prisma/tenant-client';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  Max,
} from 'class-validator';
import { TenantCrmService } from './tenant-crm.service';
import { JwtAuthGuard } from '../../infrastructure/identity/jwt-auth.guard';
import { ActiveMemberGuard, DomainWriteGuard, RequireMemberDomain } from './member-access.guard';

class CreateLeadDto {
  @IsString() @IsNotEmpty()
  name!: string;

  @IsOptional() @IsString()
  phone?: string;

  @IsOptional() @IsEmail()
  email?: string;

  @IsOptional() @IsEnum(CrmLeadSource)
  source?: CrmLeadSource;

  @IsOptional() @IsString()
  interestedUnitId?: string;

  @IsOptional() @IsString()
  assignedTo?: string;

  @IsOptional() @IsString()
  brokerName?: string;

  @IsOptional() @IsString()
  notes?: string;
}

class UpdateLeadDto {
  @IsOptional() @IsEnum(CrmLeadStatus)
  status?: CrmLeadStatus;

  @IsOptional() @IsString()
  assignedTo?: string;

  @IsOptional() @IsString()
  phone?: string;

  @IsOptional() @IsEmail()
  email?: string;

  @IsOptional() @IsString()
  notes?: string;

  @IsOptional() @IsString()
  lostReason?: string;
}

/**
 * Broker CRM (§ Week 30) — lead pipeline through lease conversion.
 * All writes are leasing-domain gated.
 */

class ConvertLeadDto {
  @IsString() @IsNotEmpty()
  leadId!: string;

  @IsString() @IsNotEmpty()
  unitId!: string;

  @IsString() @IsNotEmpty()
  startDate!: string;

  @IsString() @IsNotEmpty()
  endDate!: string;

  @IsNumber() @Min(1)
  monthlyRent!: number;

  @IsOptional() @IsNumber()
  securityDeposit?: number;

  @IsOptional() @IsNumber() @Min(0) @Max(100)
  brokerCommissionPct?: number;
}

@ApiTags('Tenant CRM')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ActiveMemberGuard)
@Controller('tenant/crm')
export class TenantCrmController {
  constructor(private readonly crm: TenantCrmService) {}

  @Post('leads')
  @UseGuards(JwtAuthGuard, ActiveMemberGuard, DomainWriteGuard)
  @RequireMemberDomain('leasing')
  @ApiOperation({ summary: 'Create a lead (marketplace inquiry, walk-in, referral…)' })
  async createLead(@Req() req: any, @Body() body: CreateLeadDto) {
    if (!body?.name?.trim()) throw new BadRequestException('name is required');
    return this.crm.createLead(this.orgId(req), body);
  }

  @Get('leads')
  @ApiOperation({ summary: 'List leads (filter by status / assignee)' })
  async listLeads(
    @Req() req: any,
    @Query('status') status?: CrmLeadStatus,
    @Query('assignedTo') assignedTo?: string,
  ) {
    return this.crm.listLeads(this.orgId(req), { status, assignedTo });
  }

  @Patch('leads/:leadId')
  @UseGuards(JwtAuthGuard, ActiveMemberGuard, DomainWriteGuard)
  @RequireMemberDomain('leasing')
  async updateLead(
    @Req() req: any,
    @Param('leadId') leadId: string,
    @Body() body: UpdateLeadDto,
  ) {
    return this.crm.updateLead(this.orgId(req), leadId, body);
  }
  private orgId(req: any): string {
    const orgId = req.tenantContext?.organizationId;
    if (!orgId) throw new BadRequestException('Missing tenant context');
    return orgId;
  }

  @Post('leads/:leadId/convert')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, ActiveMemberGuard, DomainWriteGuard)
  @RequireMemberDomain('leasing')
  @ApiOperation({
    summary: 'Convert a NEGOTIATING lead → renter + ACTIVE lease (+ broker commission capture)',
  })
  async convertLead(
    @Req() req: any,
    @Body()
    body: ConvertLeadDto,
  ) {
    if (!body?.leadId || !body?.unitId || !body?.monthlyRent) {
      throw new BadRequestException('leadId, unitId and monthlyRent are required');
    }
    const { leadId, ...rest } = body;
    return this.crm.convertLead(this.orgId(req), leadId, rest);
  }

  @Get('report')
  @ApiOperation({ summary: 'Pipeline report — counts by status, conversion rate, per-assignee' })
  async report(@Req() req: any) {
    return this.crm.report(this.orgId(req));
  }

  // ── Viewings (Week 30 tail) ──

  @Post('leads/:leadId/viewings')
  @UseGuards(JwtAuthGuard, ActiveMemberGuard, DomainWriteGuard)
  @RequireMemberDomain('leasing')
  @ApiOperation({ summary: 'Schedule a viewing for a lead' })
  async scheduleViewing(
    @Req() req: any,
    @Param('leadId') leadId: string,
    @Body() body: { scheduledAt: string; notes?: string },
  ) {
    if (!body?.scheduledAt) throw new BadRequestException('scheduledAt is required');
    return this.crm.scheduleViewing(this.orgId(req), leadId, body);
  }

  @Get('leads/:leadId/viewings')
  @ApiOperation({ summary: 'List viewings for a lead (newest first)' })
  async listViewings(@Req() req: any, @Param('leadId') leadId: string) {
    return this.crm.listViewings(this.orgId(req), leadId);
  }

  @Patch('viewings/:viewingId')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, ActiveMemberGuard, DomainWriteGuard)
  @RequireMemberDomain('leasing')
  @ApiOperation({ summary: 'Update viewing — status (COMPLETED/NO_SHOW/CANCELLED), notes, reschedule' })
  async updateViewing(
    @Req() req: any,
    @Param('viewingId') viewingId: string,
    @Body()
    body: {
      status?: 'SCHEDULED' | 'COMPLETED' | 'NO_SHOW' | 'CANCELLED';
      notes?: string;
      scheduledAt?: string;
    },
  ) {
    return this.crm.updateViewing(this.orgId(req), viewingId, body);
  }

  // ── Commission payouts (Week 30 tail) ──

  @Get('payouts')
  @ApiOperation({ summary: 'Broker commission payouts (filter by status DUE/PAID)' })
  async listPayouts(@Req() req: any, @Query('status') status?: 'DUE' | 'PAID') {
    return this.crm.listPayouts(this.orgId(req), status);
  }

  @Post('payouts/:payoutId/settle')
  @HttpCode(HttpStatus.OK)
  @UseGuards(DomainWriteGuard)
  @RequireMemberDomain('billing')
  @ApiOperation({ summary: 'Settle a DUE payout — records method/reference and marks PAID' })
  async settlePayout(
    @Req() req: any,
    @Param('payoutId') payoutId: string,
    @Body() body: { method: string; reference?: string; recordedBy?: string },
  ) {
    if (!body?.method) throw new BadRequestException('method is required');
    return this.crm.settlePayout(this.orgId(req), payoutId, body);
  }
}
