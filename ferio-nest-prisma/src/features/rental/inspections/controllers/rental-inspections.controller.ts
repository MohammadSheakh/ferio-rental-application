import { Controller, Get, Post, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RentalInspectionsService } from '../services/rental-inspections.service';
import { CreateInspectionDto } from '../dto/rental-inspections.dto';
import { AuthGuard } from '@app/common';

@ApiTags('Rental - Property Inspections & Move-In/Move-Out Audits')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('api/rental/inspections')
export class RentalInspectionsController {
  constructor(private readonly inspectionsService: RentalInspectionsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a Move-In, Move-Out, or Periodic Property Inspection' })
  async createInspection(@Body() dto: CreateInspectionDto, @Request() req: any) {
    const userId = req.user?.id || req.user?.sub;
    const data = await this.inspectionsService.createInspection(dto, userId);
    return {
      success: true,
      message: `Inspection '${dto.inspectionType}' created successfully with ${data.damagedItemsCount} damaged items noted.`,
      data,
    };
  }

  @Get('unit/:unitId')
  @ApiOperation({ summary: 'Get inspection history for a unit' })
  async getInspectionsByUnit(@Param('unitId') unitId: string) {
    const data = await this.inspectionsService.getInspectionsByUnit(unitId);
    return {
      success: true,
      data,
    };
  }
}
