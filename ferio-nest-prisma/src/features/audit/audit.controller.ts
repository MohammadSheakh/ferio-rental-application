import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  AuthGuard,
  PERMISSIONS,
  Permissions,
  PermissionsGuard,
  Roles,
  RolesGuard,
} from '@app/common';
import { AuditService } from './audit.service';
import { AuditLogQueryDto } from './dto/audit.dto';

@ApiTags('Admin Audit')
@ApiBearerAuth()
@Controller('admin/audit-logs')
@UseGuards(AuthGuard, RolesGuard, PermissionsGuard)
@Roles('admin')
@Permissions(PERMISSIONS.AUDIT_READ)
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  getAuditLogs(@Query() query: AuditLogQueryDto) {
    return this.audit.getAuditLogs(query);
  }
}
