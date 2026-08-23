import { Controller, Get, Post, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RentalAdminService } from '../services/rental-admin.service';
import { UpdateOrganizationStatusDto, SetFeatureFlagDto } from '../dto/rental-admin.dto';
import { AuthGuard } from '@app/common';

@ApiTags('Rental - SaaS Platform Administration & Super-Admin System Gateway')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('api/rental/admin')
export class RentalAdminController {
  constructor(private readonly adminService: RentalAdminService) {}

  @Get('organizations')
  @ApiOperation({ summary: 'Get directory of all registered tenant organizations (Super-Admin)' })
  async getAllOrganizations() {
    const data = await this.adminService.getAllOrganizations();
    return {
      success: true,
      data,
    };
  }

  @Post('organizations/:id/status')
  @ApiOperation({ summary: 'Suspend, Activate, or Update organization tenant account status' })
  async updateOrganizationStatus(@Param('id') id: string, @Body() dto: UpdateOrganizationStatusDto, @Request() req: any) {
    const userId = req.user?.id || req.user?.sub;
    const data = await this.adminService.updateOrganizationStatus(id, dto, userId);
    return {
      success: true,
      message: `Organization '${id}' status updated to ${dto.status}.`,
      data,
    };
  }

  @Post('feature-flags')
  @ApiOperation({ summary: 'Set or update global/organization feature flags' })
  async setFeatureFlag(@Body() dto: SetFeatureFlagDto) {
    const data = await this.adminService.setFeatureFlag(dto);
    return {
      success: true,
      message: `Feature flag '${dto.flagKey}' set to ${dto.enabled}.`,
      data,
    };
  }

  @Get('system-health')
  @ApiOperation({ summary: 'Get SaaS platform infrastructure health, database connection pool & queue metrics' })
  async getPlatformHealth() {
    const data = await this.adminService.getPlatformHealth();
    return {
      success: true,
      data,
    };
  }
}
