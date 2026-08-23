import { Controller, Get, Post, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RentalImportsService } from '../services/rental-imports.service';
import { ValidateImportBatchDto, ExecuteImportBatchDto } from '../dto/rental-imports.dto';
import { AuthGuard } from '@app/common';

@ApiTags('Rental - Data Import & Bulk Onboarding Engine')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('api/rental/imports')
export class RentalImportsController {
  constructor(private readonly importsService: RentalImportsService) {}

  @Post('validate')
  @ApiOperation({ summary: 'Dry-run validation of spreadsheet import rows for onboarding properties, units, tenants' })
  async validateImportBatch(@Body() dto: ValidateImportBatchDto, @Request() req: any) {
    const userId = req.user?.id || req.user?.sub;
    const data = await this.importsService.validateImportBatch(dto, userId);
    return {
      success: true,
      message: `Dry-run completed. ${data.validRowsCount}/${data.totalRows} rows valid.`,
      data,
    };
  }

  @Post('execute')
  @ApiOperation({ summary: 'Execute pre-validated batch import job for bulk property manager onboarding' })
  async executeImportBatch(@Body() dto: ExecuteImportBatchDto, @Request() req: any) {
    const userId = req.user?.id || req.user?.sub;
    const data = await this.importsService.executeImportBatch(dto, userId);
    return {
      success: true,
      message: `Batch import '${dto.importJobId}' completed successfully. ${data.importedRecordsCount} records created.`,
      data,
    };
  }

  @Get('status/:importJobId')
  @ApiOperation({ summary: 'Get background batch import job progress status and error details' })
  async getImportJobStatus(@Param('importJobId') importJobId: string) {
    const data = await this.importsService.getImportJobStatus(importJobId);
    return {
      success: true,
      data,
    };
  }
}
