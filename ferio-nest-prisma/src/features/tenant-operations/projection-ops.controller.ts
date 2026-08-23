import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ControlPlanePrismaService } from '../../infrastructure/control-plane/control-plane-prisma.service';
import { TenantDatabaseManager } from '../../infrastructure/tenant/tenant-database.manager';
import { MarketplaceProjectionWorker } from './outbox/marketplace-projection.worker';
import { PlatformAdminGuard, PlatformRoles } from '../../infrastructure/identity/platform-admin.guard';

/**
 * Projection Ops Controller
 *
 * Platform-admin endpoints for the cross-plane outbox. Lives beside
 * MarketplaceProjectionWorker (which owns tenant-DB event access) while
 * exposing routes under the `platform/` admin namespace.
 */
@ApiTags('Platform Admin')
@ApiBearerAuth()
@UseGuards(PlatformAdminGuard)
@PlatformRoles('SUPER_ADMIN', 'ADMIN')
@Controller('platform')
export class ProjectionOpsController {
  constructor(
    private readonly controlPlane: ControlPlanePrismaService,
    private readonly tenantDbManager: TenantDatabaseManager,
    private readonly projectionWorker: MarketplaceProjectionWorker,
  ) {}

  @Get('organizations/:id/outbox/failed')
  @ApiOperation({
    summary: 'List dead-lettered projection events for an organization',
  })
  async listFailedOutboxEvents(@Param('id') id: string) {
    const db = await this.tenantDbManager.getTenantDatabase(id);
    return db.tenantOutboxEvent.findMany({
      where: { status: 'FAILED' },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  @Post('organizations/:id/outbox/retry-failed')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Requeue all dead-lettered projection events for an organization',
  })
  async retryFailedOutboxEvents(@Param('id') id: string) {
    const db = await this.tenantDbManager.getTenantDatabase(id);
    const result = await db.tenantOutboxEvent.updateMany({
      where: { status: 'FAILED' },
      data: {
        status: 'PENDING',
        attempts: 0,
        availableAt: new Date(),
        lastError: null,
      },
    });
    return { requeued: result.count };
  }

  @Post('organizations/:id/outbox/reconcile')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Reconcile published units against central marketplace projections',
  })
  async reconcileOrganizationProjections(
    @Param('id') id: string,
    @Body() body: { actorId?: string },
  ) {
    const result = await this.projectionWorker.reconcileOrganization(id);

    await this.controlPlane.platformAuditEvent.create({
      data: {
        action: 'projection.reconciled',
        actorType: 'PLATFORM_USER',
        resourceType: 'SaasOrganization',
        resourceId: id,
        organizationId: id,
        metadata: { ...result, triggeredBy: body?.actorId ?? 'platform-admin' },
      },
    });

    return result;
  }
}
