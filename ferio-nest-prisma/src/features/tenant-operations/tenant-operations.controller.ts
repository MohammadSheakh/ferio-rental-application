import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Req,
  BadRequestException,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TenantPropertyService } from './tenant-property.service';
import { TenantLeaseService } from './tenant-lease.service';
import { TenantBillingService } from './tenant-billing.service';
import { TenantUtilityService } from './tenant-utility.service';
import { TenantMaintenanceService } from './tenant-maintenance.service';
import { TenantReportingService } from './tenant-reporting.service';
import { MarketplaceProjectionService } from './marketplace-projection.service';
import {
  CreateTenantPropertyDto,
  CreateTenantUnitDto,
  CreateTenantRenterDto,
  CreateTenantLeaseDto,
  AddChargeDefinitionDto,
  GenerateInvoiceDto,
  RecordPaymentDto,
  CreateUtilityAccountDto,
  CreateMeterDto,
  RecordMeterReadingDto,
  CreateMaintenanceRequestDto,
  AssignWorkOrderDto,
} from './dto/tenant-operations.dto';
import { TenantContext } from '../../infrastructure/tenant/tenant-resolver.middleware';
import { MaintenanceStatus } from '@prisma/tenant-client';
import { JwtAuthGuard } from '../../infrastructure/identity/jwt-auth.guard';
import { Identity } from '../../infrastructure/identity/identity.decorators';
import { TenantDatabaseManager } from '../../infrastructure/tenant/tenant-database.manager';
import { ActiveMemberGuard, DomainWriteGuard, RequireMemberDomain } from './member-access.guard';
import { assertInScope, filterByScope } from './member-scope';

@ApiTags('Tenant Operations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ActiveMemberGuard)
@Controller('tenant')
export class TenantOperationsController {
  constructor(
    private readonly propertyService: TenantPropertyService,
    private readonly leaseService: TenantLeaseService,
    private readonly billingService: TenantBillingService,
    private readonly utilityService: TenantUtilityService,
    private readonly maintenanceService: TenantMaintenanceService,
    private readonly reportingService: TenantReportingService,
    private readonly projectionService: MarketplaceProjectionService,
    private readonly tenantDbManager: TenantDatabaseManager,
  ) {}

  private getOrgId(req: any): string {
    const context: TenantContext = req.tenantContext;
    if (!context || !context.organizationId) {
      throw new BadRequestException('Missing or invalid tenant context');
    }
    return context.organizationId;
  }

  // ────────────────────────────────────────────────────────────
  // Properties & Units
  // ────────────────────────────────────────────────────────────

  @Post('properties')
  @UseGuards(DomainWriteGuard)
  @RequireMemberDomain('inventory')
  @ApiOperation({ summary: 'Create a property/building in tenant workspace' })
  async createProperty(@Req() req: any, @Body() body: CreateTenantPropertyDto) {
    return this.propertyService.createProperty(this.getOrgId(req), body);
  }

  @Get('properties')
  @ApiOperation({ summary: 'List properties visible to the caller\'s membership scope' })
  async listProperties(@Req() req: any) {
    const props = await this.propertyService.listProperties(this.getOrgId(req));
    return filterByScope(req.member, props);
  }

  @Get('properties/:id')
  @ApiOperation({ summary: 'Get property details with units & owner shares' })
  async getProperty(@Req() req: any, @Param('id') id: string) {
    const prop = await this.propertyService.getPropertyById(this.getOrgId(req), id);
    assertInScope(req.member, { id: prop.id }, 'property');
    return prop;
  }

  @Post('units')
  @UseGuards(DomainWriteGuard)
  @RequireMemberDomain('inventory')
  @ApiOperation({
    summary: 'Create a unit (apartment/office/shop/warehouse) in property',
  })
  async createUnit(@Req() req: any, @Body() body: CreateTenantUnitDto) {
    return this.propertyService.createUnit(this.getOrgId(req), body);
  }

  @Get('units')
  @ApiOperation({ summary: 'List units in tenant workspace' })
  async listUnits(@Req() req: any, @Query('propertyId') propertyId?: string) {
    const units = await this.propertyService.listUnits(this.getOrgId(req), propertyId);
    return filterByScope(req.member, units);
  }

  // ────────────────────────────────────────────────────────────
  // Buildings & Ownership (Weeks 10–11)
  // ────────────────────────────────────────────────────────────

  @Post('buildings')
  @UseGuards(DomainWriteGuard)
  @RequireMemberDomain('inventory')
  @ApiOperation({ summary: 'Create a building under a property' })
  async createBuilding(
    @Req() req: any,
    @Body()
    body: { propertyId: string; name: string; totalFloors?: number; address?: string },
  ) {
    return this.propertyService.createBuilding(this.getOrgId(req), body);
  }

  @Get('buildings')
  @ApiOperation({ summary: 'List buildings (optionally by property)' })
  async listBuildings(@Req() req: any, @Query('propertyId') propertyId?: string) {
    return this.propertyService.listBuildings(this.getOrgId(req), propertyId);
  }

  @Post('units/:id/owners')
  @UseGuards(DomainWriteGuard)
  @RequireMemberDomain('inventory')
  @ApiOperation({ summary: 'Add a unit owner with share percent (≤100% active total enforced)' })
  async addUnitOwner(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: Record<string, any>,
  ) {
    return this.propertyService.addUnitOwner(this.getOrgId(req), id, body as any);
  }

  @Get('units/:id/ownership')
  @ApiOperation({ summary: 'Ownership summary — active owners, allocated/unallocated share' })
  async getUnitOwnership(@Req() req: any, @Param('id') id: string) {
    return this.propertyService.getUnitOwnershipSummary(this.getOrgId(req), id);
  }

  @Patch('ownership/unit/:ownershipId/share')
  @UseGuards(DomainWriteGuard)
  @RequireMemberDomain('inventory')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change an owner share (closes old record, preserves history)' })
  async updateUnitOwnerShare(
    @Req() req: any,
    @Param('ownershipId') ownershipId: string,
    @Body() body: { sharePercent: number },
  ) {
    if (typeof body?.sharePercent !== 'number') {
      throw new BadRequestException('sharePercent must be a number');
    }
    return this.propertyService.updateUnitOwnerShare(
      this.getOrgId(req),
      ownershipId,
      body.sharePercent,
    );
  }

  @Patch('ownership/unit/:ownershipId/payment')
  @UseGuards(DomainWriteGuard)
  @RequireMemberDomain('inventory')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Set rent payment destination for an owner share (bKash/Nagad/bank)' })
  async updateUnitOwnerPayment(
    @Req() req: any,
    @Param('ownershipId') ownershipId: string,
    @Body() body: Record<string, any>,
  ) {
    return this.propertyService.updateUnitOwnerPaymentDestination(
      this.getOrgId(req),
      ownershipId,
      body as any,
    );
  }

  @Post('ownership/unit/:ownershipId/end')
  @UseGuards(DomainWriteGuard)
  @RequireMemberDomain('inventory')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "End an owner's stake (at least one owner must remain)" })
  async endUnitOwnership(@Req() req: any, @Param('ownershipId') ownershipId: string) {
    return this.propertyService.endUnitOwnership(this.getOrgId(req), ownershipId);
  }

  @Post('units/:id/publish')
  @UseGuards(DomainWriteGuard)
  @RequireMemberDomain('inventory')
  @ApiOperation({
    summary: 'Publish managed unit to central marketplace (async via outbox)',
  })
  async publishUnit(
    @Req() req: any,
    @Param('id') id: string,
    @Body()
    body: {
      sellerAccountId: string;
      price?: number;
      purpose?: 'RENT' | 'SALE';
      assetType?: string;
    },
  ) {
    return this.projectionService.publishUnitToMarketplace(
      this.getOrgId(req),
      id,
      body.sellerAccountId,
      {
        price: body.price,
        purpose: body.purpose,
        assetType: body.assetType,
      },
    );
  }

  @Patch('units/:id/publish')
  @UseGuards(DomainWriteGuard)
  @RequireMemberDomain('inventory')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update an already-published unit projection (price/description)',
  })
  async updatePublishedUnit(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { price?: number; description?: string },
  ) {
    return this.projectionService.updatePublishedUnit(
      this.getOrgId(req),
      id,
      body,
    );
  }

  @Post('units/:id/unpublish')
  @UseGuards(DomainWriteGuard)
  @RequireMemberDomain('inventory')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unpublish/pause unit marketplace listing' })
  async unpublishUnit(@Req() req: any, @Param('id') id: string) {
    return this.projectionService.unpublishUnitFromMarketplace(
      this.getOrgId(req),
      id,
    );
  }

  @Post('units/:id/mark-rented')
  @UseGuards(DomainWriteGuard)
  @RequireMemberDomain('inventory')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark unit listing as RENTED and occupy the unit' })
  async markUnitRented(@Req() req: any, @Param('id') id: string) {
    return this.projectionService.markUnitRented(this.getOrgId(req), id);
  }

  // ────────────────────────────────────────────────────────────
  // Renters & Leases
  // ────────────────────────────────────────────────────────────

  @Post('renters')
  @UseGuards(DomainWriteGuard)
  @RequireMemberDomain('leasing')
  @ApiOperation({ summary: 'Create a renter profile with NID number' })
  async createRenter(@Req() req: any, @Body() body: CreateTenantRenterDto) {
    return this.leaseService.createRenter(this.getOrgId(req), body);
  }

  @Get('renters')
  @ApiOperation({ summary: 'List renters in tenant workspace' })
  async listRenters(@Req() req: any) {
    return this.leaseService.listRenters(this.getOrgId(req));
  }

  @Post('leases')
  @UseGuards(DomainWriteGuard)
  @RequireMemberDomain('leasing')
  @ApiOperation({ summary: 'Create a new lease agreement' })
  async createLease(@Req() req: any, @Body() body: CreateTenantLeaseDto) {
    return this.leaseService.createLease(this.getOrgId(req), body);
  }

  @Get('leases')
  @ApiOperation({ summary: 'List all lease agreements in tenant workspace' })
  async listLeases(@Req() req: any) {
    return this.leaseService.listLeases(this.getOrgId(req));
  }

  // ────────────────────────────────────────────────────────────
  // Billing & Multi-Beneficiary Payments
  // ────────────────────────────────────────────────────────────

  @Post('billing/charges')
  @UseGuards(DomainWriteGuard)
  @RequireMemberDomain('billing')
  @ApiOperation({
    summary: 'Add charge definition (rent, service charge, electricity, gas, internet)',
  })
  async addChargeDefinition(@Req() req: any, @Body() body: AddChargeDefinitionDto) {
    return this.billingService.addChargeDefinition(this.getOrgId(req), body);
  }

  @Get('billing/accounts')
  @ApiOperation({ summary: 'Get-or-create the billing account for a unit' })
  async getBillingAccount(@Req() req: any, @Query('unitId') unitId?: string) {
    if (!unitId) throw new BadRequestException('unitId query param is required');
    return this.billingService.getOrCreateBillingAccount(this.getOrgId(req), unitId);
  }

  @Post('billing/invoices')
  @UseGuards(DomainWriteGuard)
  @RequireMemberDomain('billing')
  @ApiOperation({
    summary:
      'Generate monthly itemized invoice with multi-beneficiary line routing',
  })
  async generateInvoice(@Req() req: any, @Body() body: GenerateInvoiceDto) {
    return this.billingService.generateMonthlyInvoice(this.getOrgId(req), body);
  }

  @Post('billing/payments')
  @UseGuards(DomainWriteGuard)
  @RequireMemberDomain('billing')
  @ApiOperation({
    summary: 'Record payment report against invoice (enters PENDING/REPORTED — staff verifies)',
  })
  async recordPayment(@Req() req: any, @Body() body: RecordPaymentDto) {
    return this.billingService.recordPayment(this.getOrgId(req), body);
  }

  // ── Payment verification workflow (§Week 19) ──

  @Post('billing/payments/:paymentId/verify')
  @UseGuards(DomainWriteGuard)
  @RequireMemberDomain('billing')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify a reported payment → allocates to invoice + issues receipt' })
  async verifyPayment(
    @Req() req: any,
    @Param('paymentId') paymentId: string,
    @Body() body: { verifiedBy: string },
  ) {
    if (!body?.verifiedBy) throw new BadRequestException('verifiedBy is required');
    return this.billingService.verifyPayment(this.getOrgId(req), paymentId, body.verifiedBy);
  }

  @Post('billing/payments/:paymentId/reject')
  @UseGuards(DomainWriteGuard)
  @RequireMemberDomain('billing')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reject an unverified payment report with a reason' })
  async rejectPayment(
    @Req() req: any,
    @Param('paymentId') paymentId: string,
    @Body() body: { rejectedBy: string; reason: string },
  ) {
    if (!body?.rejectedBy || !body?.reason) {
      throw new BadRequestException('rejectedBy and reason are required');
    }
    return this.billingService.rejectPayment(
      this.getOrgId(req),
      paymentId,
      body.rejectedBy,
      body.reason,
    );
  }

  @Post('billing/payments/:paymentId/reverse')
  @UseGuards(DomainWriteGuard)
  @RequireMemberDomain('billing')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reverse a verified/settled payment (decrements invoice atomically)' })
  async reversePayment(
    @Req() req: any,
    @Param('paymentId') paymentId: string,
    @Body() body: { reversedBy: string; reason: string },
  ) {
    if (!body?.reversedBy || !body?.reason) {
      throw new BadRequestException('reversedBy and reason are required');
    }
    return this.billingService.reversePayment(
      this.getOrgId(req),
      paymentId,
      body.reversedBy,
      body.reason,
    );
  }

  @Get('billing/invoices')
  @ApiOperation({ summary: 'List invoices across tenant workspace' })
  async listInvoices(@Req() req: any, @Query('unitId') unitId?: string) {
    return this.billingService.listInvoices(this.getOrgId(req), unitId);
  }

  // ────────────────────────────────────────────────────────────
  // Notices & Documents (communications; visible in Renter Portal)
  // ────────────────────────────────────────────────────────────

  @Post('notices')
  @UseGuards(DomainWriteGuard)
  @RequireMemberDomain('leasing')
  @ApiOperation({ summary: 'Post a notice — organization-wide or targeted at one unit' })
  async createNotice(
    @Req() req: any,
    @Identity() identity: any,
    @Body()
    body: { title: string; body?: string; unitId?: string },
  ) {
    if (!body?.title?.trim()) throw new BadRequestException('title is required');
    const db = await this.tenantDbManager.getTenantDatabase(this.getOrgId(req));
    return db.notice.create({
      data: {
        title: body.title,
        body: body.body,
        unitId: body.unitId ?? null,
        postedBy: identity?.userId ?? null,
      },
    });
  }

  @Get('notices')
  @ApiOperation({ summary: 'List notices (newest first, optionally per unit)' })
  async listNotices(@Req() req: any, @Query('unitId') unitId?: string) {
    const db = await this.tenantDbManager.getTenantDatabase(this.getOrgId(req));
    return db.notice.findMany({
      where: unitId ? { OR: [{ unitId }, { unitId: null }] } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  @Post('documents')
  @UseGuards(DomainWriteGuard)
  @RequireMemberDomain('inventory')
  @ApiOperation({ summary: 'Attach a document to a UNIT or LEASE (renter-visible for those types)' })
  async createDocument(
    @Req() req: any,
    @Identity() identity: any,
    @Body()
    body: {
      category: string;
      name: string;
      fileUrl: string;
      attachedToType: 'UNIT' | 'LEASE' | 'PROPERTY' | 'PAYMENT' | 'OTHER';
      attachedToId?: string;
    },
  ) {
    if (!body?.name || !body?.fileUrl || !body?.attachedToType) {
      throw new BadRequestException('name, fileUrl and attachedToType are required');
    }
    if (!['UNIT', 'LEASE'].includes(body.attachedToType)) {
      throw new BadRequestException('Renter-visible documents must target UNIT or LEASE');
    }
    if (!body.attachedToId) {
      throw new BadRequestException('attachedToId is required');
    }
    const db = await this.tenantDbManager.getTenantDatabase(this.getOrgId(req));
    return db.tenantDocument.create({
      data: {
        category: body.category || 'OTHER',
        name: body.name,
        fileUrl: body.fileUrl,
        attachedToType: body.attachedToType,
        attachedToId: body.attachedToId,
        uploadedBy: identity?.userId ?? null,
      },
    });
  }

  @Get('documents')
  @ApiOperation({ summary: 'List tenant documents by attachment' })
  async listDocuments(
    @Req() req: any,
    @Query('attachedToType') attachedToType?: string,
    @Query('attachedToId') attachedToId?: string,
  ) {
    const db = await this.tenantDbManager.getTenantDatabase(this.getOrgId(req));
    return db.tenantDocument.findMany({
      where:
        attachedToType && attachedToId
          ? { attachedToType, attachedToId }
          : undefined,
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  // ────────────────────────────────────────────────────────────
  // Utilities & Meter Readings
  // ────────────────────────────────────────────────────────────

  @Post('utilities')
  @UseGuards(DomainWriteGuard)
  @RequireMemberDomain('inventory')
  @ApiOperation({
    summary: 'Create utility account (DESCO, DPDC, WASA, Titas)',
  })
  async createUtilityAccount(
    @Req() req: any,
    @Body() body: CreateUtilityAccountDto,
  ) {
    return this.utilityService.createUtilityAccount(this.getOrgId(req), body);
  }

  @Post('utilities/meters')
  @UseGuards(DomainWriteGuard)
  @RequireMemberDomain('inventory')
  @ApiOperation({ summary: 'Register a meter under a utility account' })
  async createMeter(@Req() req: any, @Body() body: CreateMeterDto) {
    return this.utilityService.createMeter(this.getOrgId(req), body);
  }

  @Post('utilities/meter-readings')
  @UseGuards(DomainWriteGuard)
  @RequireMemberDomain('inventory')
  @ApiOperation({ summary: 'Record utility meter reading & consumption' })
  async recordMeterReading(
    @Req() req: any,
    @Body() body: RecordMeterReadingDto,
  ) {
    return this.utilityService.recordMeterReading(this.getOrgId(req), body);
  }

  @Get('utilities')
  @ApiOperation({ summary: 'List utility accounts & meter readings' })
  async listUtilities(@Req() req: any, @Query('unitId') unitId?: string) {
    return this.utilityService.listUtilityAccounts(this.getOrgId(req), unitId);
  }

  // ────────────────────────────────────────────────────────────
  // Maintenance & Work Orders
  // ────────────────────────────────────────────────────────────

  @Post('maintenance')
  @UseGuards(DomainWriteGuard)
  @RequireMemberDomain('maintenance')
  @ApiOperation({ summary: 'Report a maintenance request' })
  async createMaintenanceRequest(
    @Req() req: any,
    @Body() body: CreateMaintenanceRequestDto,
  ) {
    return this.maintenanceService.createMaintenanceRequest(
      this.getOrgId(req),
      body,
    );
  }

  @Post('maintenance/work-orders')
  @UseGuards(DomainWriteGuard)
  @RequireMemberDomain('maintenance')
  @ApiOperation({ summary: 'Assign work order to crew/vendor' })
  async assignWorkOrder(@Req() req: any, @Body() body: AssignWorkOrderDto) {
    return this.maintenanceService.assignWorkOrder(this.getOrgId(req), body);
  }

  @Patch('maintenance/:id/status')
  @UseGuards(DomainWriteGuard)
  @RequireMemberDomain('maintenance')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update maintenance request status' })
  async updateMaintenanceStatus(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { status: MaintenanceStatus },
  ) {
    return this.maintenanceService.updateStatus(
      this.getOrgId(req),
      id,
      body.status,
    );
  }

  @Get('maintenance')
  @ApiOperation({ summary: 'List maintenance requests & work orders' })
  async listMaintenance(@Req() req: any, @Query('unitId') unitId?: string) {
    return this.maintenanceService.listMaintenanceRequests(
      this.getOrgId(req),
      unitId,
    );
  }

  // ────────────────────────────────────────────────────────────
  // Executive Reports & Analytics
  // ────────────────────────────────────────────────────────────

  @Get('reports/occupancy')
  @ApiOperation({ summary: 'Get occupancy and vacancy analytics' })
  async getOccupancyReport(@Req() req: any) {
    return this.reportingService.getOccupancyReport(this.getOrgId(req));
  }

  @Get('reports/financial')
  @ApiOperation({ summary: 'Get rent collection and financial report' })
  async getFinancialReport(@Req() req: any) {
    return this.reportingService.getFinancialReport(this.getOrgId(req));
  }

  @Get('reports/beneficiary-split')
  @ApiOperation({ summary: 'Get multi-beneficiary receivable split report' })
  async getBeneficiarySplitReport(@Req() req: any) {
    return this.reportingService.getBeneficiarySplitReport(this.getOrgId(req));
  }

  @Get('reports/maintenance')
  @ApiOperation({
    summary: 'Get maintenance expenditure and resolution SLA report',
  })
  async getMaintenanceReport(@Req() req: any) {
    return this.reportingService.getMaintenanceReport(this.getOrgId(req));
  }

  @Get('reports/overdue-renters')
  @ApiOperation({ summary: 'Renters with overdue invoices — name, unit, outstanding' })
  async getOverdueRentersReport(@Req() req: any) {
    return this.reportingService.getOverdueRentersReport(this.getOrgId(req));
  }

  @Get('reports/lease-expiry')
  @ApiOperation({ summary: 'ACTIVE leases expiring within N days' })
  async getLeaseExpiryReport(
    @Req() req: any,
    @Query('days') days?: string,
  ) {
    return this.reportingService.getLeaseExpiryReport(
      this.getOrgId(req),
      days ? parseInt(days, 10) : undefined,
    );
  }

  @Get('reports/utility-collection')
  @ApiOperation({ summary: 'Utility + service charge collection breakdown by category' })
  async getUtilityCollectionReport(@Req() req: any) {
    return this.reportingService.getUtilityCollectionReport(this.getOrgId(req));
  }
}
