import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../infrastructure/identity/jwt-auth.guard';
import { ActiveMemberGuard } from './member-access.guard';
import { TenantWebhookService } from './tenant-webhook.service';

/**
 * § Week 33 webhook subscriptions — workspace-owner surface.
 * Reads are member-visible; create/delete/toggle are restricted to
 * ORGANIZATION_OWNER inside the service.
 */
@ApiTags('Tenant — Webhooks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ActiveMemberGuard)
@Controller('tenant/webhooks')
export class TenantWebhookController {
  constructor(private readonly webhooks: TenantWebhookService) {}

  private role(req: any): string {
    return req.member?.role;
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Subscribe a signed webhook endpoint (owner only; secret shown once)' })
  async create(@Req() req: any, @Body() body: { url: string; events: string[]; description?: string }) {
    await this.webhooks.assertOwner(this.role(req));
    return this.webhooks.createEndpoint(this.getOrgId(req), body);
  }

  private getOrgId(req: any): string {
    return req.tenantContext?.organizationId;
  }

  @Get()
  @ApiOperation({ summary: 'List subscribed endpoints (secrets never returned)' })
  async list(@Req() req: any) {
    return this.webhooks.listEndpoints(this.getOrgId(req));
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Unsubscribe an endpoint (owner only)' })
  async remove(@Req() req: any, @Param('id') id: string) {
    await this.webhooks.assertOwner(this.role(req));
    return this.webhooks.deleteEndpoint(this.getOrgId(req), id);
  }

  @Patch(':id/enabled')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Enable/disable an endpoint without deleting it (owner only)' })
  async toggle(@Req() req: any, @Param('id') id: string, @Body() body: { enabled: boolean }) {
    await this.webhooks.assertOwner(this.role(req));
    return this.webhooks.toggleEndpoint(this.getOrgId(req), id, !!body?.enabled);
  }

  @Get('deliveries')
  @ApiOperation({ summary: 'Delivery log (newest 100) filterable by endpoint/status' })
  async deliveries(
    @Req() req: any,
    @Query('endpointId') endpointId?: string,
    @Query('status') status?: string,
  ) {
    return this.webhooks.listDeliveries(this.getOrgId(req), { endpointId, status });
  }

  @Post('deliveries/:id/redeliver')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Replay a delivery immediately (owner only)' })
  async redeliver(@Req() req: any, @Param('id') id: string) {
    await this.webhooks.assertOwner(this.role(req));
    return this.webhooks.redeliver(this.getOrgId(req), id);
  }
}
