import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  ForbiddenException,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../infrastructure/identity/jwt-auth.guard';
import { ActiveMemberGuard } from '../tenant-operations/member-access.guard';
import { DomainVerificationService } from '../../infrastructure/domains/domain-verification.service';

/**
 * § Week 26 Custom Domains — organization-owner surface.
 * Add a custom domain, verify ownership via DNS proof (TXT token or
 * CNAME), promote to primary, remove. Unverified domains never resolve.
 */
@ApiTags('Tenant — Custom Domains')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ActiveMemberGuard)
@Controller('tenant/domains')
export class TenantDomainController {
  constructor(private readonly domains: DomainVerificationService) {}

  private assertOwner(req: any): string {
    if (req.member?.role !== 'ORGANIZATION_OWNER') {
      throw new ForbiddenException(
        'Only ORGANIZATION_OWNER can manage custom domains',
      );
    }
    return req.tenantContext?.organizationId as string;
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add a custom domain (owner only) → verification instructions' })
  async add(@Req() req: any, @Body() body: { domain: string }) {
    const orgId = this.assertOwner(req);
    return this.domains.addDomain(
      orgId,
      DomainVerificationService.normalize(body?.domain),
    );
  }

  @Get()
  @ApiOperation({ summary: 'List my workspace domains + verification state' })
  async list(@Req() req: any) {
    return this.domains.listDomains(req.tenantContext?.organizationId);
  }

  @Post(':id/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Run the DNS ownership check now (owner only)' })
  async verify(@Req() req: any, @Param('id') id: string) {
    const orgId = this.assertOwner(req);
    return this.domains.verifyDomain(orgId, id);
  }

  @Patch(':id/primary')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Promote a VERIFIED domain to primary (owner only)' })
  async setPrimary(@Req() req: any, @Param('id') id: string) {
    const orgId = this.assertOwner(req);
    return this.domains.setPrimary(orgId, id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove a domain (owner only)' })
  async remove(@Req() req: any, @Param('id') id: string) {
    const orgId = this.assertOwner(req);
    return this.domains.removeDomain(orgId, id);
  }
}
