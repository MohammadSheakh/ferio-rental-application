import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Query,
  Req,
  BadRequestException,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CrmLeadStatus, CrmLeadSource } from '@prisma/tenant-client';
import { TenantCrmService } from './tenant-crm.service';
import { DomainWriteGuard, RequireMemberDomain } from './member-access.guard';

class CreateLeadDto {
  name!: string;
  phone?: string;
  email?: string;
  source?: CrmLeadSource;
  interestedUnitId?: string;
  assignedTo?: string;
  brokerName?: string;
  notes?: string;
}

class UpdateLeadDto {
  status?: CrmLeadStatus;
  assignedTo?: string;
  phone?: string;
  email?: string;
  notes?: string;
  lostReason?: string;
}

/**
 * Broker CRM (§ Week 30) — lead pipeline through lease conversion.
 * All writes are leasing-domain gated.
 */
@ApiTags('Tenant CRM')
@ApiBearerAuth()
@Controller('tenant/crm')
export class TenantCrmController {
  constructor(private readonly crm: TenantCrmService) {}

  @Post('leads')
  @UseGuards(DomainWriteGuard)
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
  @UseGuards(DomainWriteGuard)
  @RequireMemberDomain('leasing')
  async updateLead(
    @Req() req: any,
    @Query('leadId') leadId: string,
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
  @UseGuards(DomainWriteGuard)
  @RequireMemberDomain('leasing')
  @ApiOperation({
    summary: 'Convert a NEGOTIATING lead → renter + ACTIVE lease (+ broker commission capture)',
  })
  async convertLead(
    @Req() req: any,
    @Body()
    body: {
      leadId: string;
      unitId: string;
      startDate: string;
      endDate: string;
      monthlyRent: number;
      securityDeposit?: number;
      brokerCommissionPct?: number;
    },
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
}
