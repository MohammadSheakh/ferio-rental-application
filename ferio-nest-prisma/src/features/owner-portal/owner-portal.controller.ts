import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../infrastructure/identity/jwt-auth.guard';
import { Identity } from '../../infrastructure/identity/identity.decorators';
import type { Identity as IdentityType } from '../../infrastructure/identity/identity.decorators';
import { OwnerPortalService } from './owner-portal.service';

/**
 * Unit Owner Portal (§ Week 29) — the owner-facing surface.
 * Identity-bound via UnitOwnership.ownerCentralUserId; cross-org fan-out.
 */
@ApiTags('Owner Portal')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('owner')
export class OwnerPortalController {
  constructor(private readonly portal: OwnerPortalService) {}

  @Get('me')
  @ApiOperation({
    summary:
      'Portfolio snapshot — owned units, co-owners, expected rent share, outstanding, active leases',
  })
  async me(@Identity() identity: IdentityType | null) {
    this.require(identity);
    return this.portal.me(identity!.userId);
  }

  @Get('invoices')
  @ApiOperation({ summary: 'Consolidated statements across every owned unit' })
  async invoices(
    @Identity() identity: IdentityType | null,
    @Query('unitId') unitId?: string,
  ) {
    this.require(identity);
    const all = await this.portal.listInvoices(identity!.userId);
    return unitId ? all.filter((i) => (i as any).billingAccount?.unit?.id === unitId) : all;
  }

  @Get('maintenance')
  @ApiOperation({ summary: 'Maintenance tickets on any owned unit' })
  async maintenance(@Identity() identity: IdentityType | null) {
    this.require(identity);
    return this.portal.listMaintenance(identity!.userId);
  }

  private require(identity: IdentityType | null): string {
    if (!identity?.userId) {
      throw new Error('Missing authenticated identity');
    }
    return identity!.userId;
  }
}
