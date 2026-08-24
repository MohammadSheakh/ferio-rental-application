import {
  Controller,
  Get,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ApiKeyGuard, type ExternalRequest } from '../../infrastructure/api-external/api-key.guard';
import { ApiScopesGuard, RequireApiScope } from '../../infrastructure/api-external/api-scopes.guard';
import { TenantDatabaseManager } from '../../infrastructure/tenant/tenant-database.manager';

/**
 * § Week 33 External API — stable, versioned, read-only surface over a
 * single organization's tenant data, authenticated by API key (not JWT),
 * scoped per credential and rate limited per key.
 */
@ApiTags('External API v1')
@ApiBearerAuth('api-key')
@UseGuards(ApiKeyGuard, ApiScopesGuard)
@Controller('external/v1')
export class ExternalApiController {
  constructor(private readonly tenantDbManager: TenantDatabaseManager) {}

  private async orgDb(req: ExternalRequest) {
    return this.tenantDbManager.getTenantDatabase(req.apiKey!.organizationId);
  }

  @Get('ping')
  @ApiOperation({ summary: 'Authenticated connectivity probe' })
  async ping(@Req() req: ExternalRequest) {
    return { pong: true, organizationId: req.apiKey?.organizationId };
  }

  @Get('units')
  @RequireApiScope('units:read')
  @ApiOperation({ summary: "List units in the key's organization" })
  async units(@Req() req: ExternalRequest, @Query('propertyId') propertyId?: string) {
    const db = await this.orgDb(req);
    const rows = await db.unit.findMany({
      where: propertyId ? { propertyId } : undefined,
      select: {
        id: true, name: true, type: true, status: true, floor: true,
        bedrooms: true, bathrooms: true, areaSqFt: true, isPublished: true,
        propertyId: true,
      },
      take: 500,
    });
    return { data: rows };
  }

  @Get('invoices')
  @RequireApiScope('invoices:read')
  @ApiOperation({ summary: 'List recent invoices across the organization' })
  async invoices(@Req() req: ExternalRequest, @Query('status') status?: string) {
    const db = await this.orgDb(req);
    const rows = await db.invoice.findMany({
      where: status ? { status: status as never } : undefined,
      select: {
        id: true, invoiceNumber: true, periodKey: true, status: true,
        totalAmount: true, paidAmount: true, dueDate: true,
        billingAccount: { select: { unit: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return { data: rows };
  }

  @Get('leases')
  @RequireApiScope('leases:read')
  @ApiOperation({ summary: 'List leases with renter + unit context' })
  async leases(@Req() req: ExternalRequest, @Query('status') status?: string) {
    const db = await this.orgDb(req);
    const rows = await db.lease.findMany({
      where: status ? { status: status as never } : undefined,
      select: {
        id: true, status: true, startDate: true, endDate: true,
        monthlyRent: true, securityDeposit: true,
        unit: { select: { name: true } },
        renter: { select: { name: true, phone: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return { data: rows };
  }

  @Get('maintenance')
  @RequireApiScope('maintenance:read')
  @ApiOperation({ summary: 'List maintenance requests' })
  async maintenance(@Req() req: ExternalRequest, @Query('status') status?: string) {
    const db = await this.orgDb(req);
    const rows = await db.maintenanceRequest.findMany({
      where: status ? { status: status as never } : undefined,
      select: {
        id: true, title: true, status: true, urgency: true, payer: true,
        estimatedCost: true, actualCost: true, createdAt: true, resolvedAt: true,
        unit: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return { data: rows };
  }
}
