import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RentalReportsService } from '../services/rental-reports.service';
import { ReportQueryDto } from '../dto/rental-reports.dto';
import { AuthGuard } from '@app/common';

@ApiTags('Rental - Advanced Reports & Financial Analytics Engine')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('api/rental/reports')
export class RentalReportsController {
  constructor(private readonly reportsService: RentalReportsService) {}

  @Get('profitability')
  @ApiOperation({ summary: 'Get Property Profitability & Net Yield Percentage Report' })
  async getPropertyProfitabilityReport(@Query() query: ReportQueryDto) {
    const data = await this.reportsService.getPropertyProfitabilityReport(query);
    return {
      success: true,
      data,
    };
  }

  @Get('occupancy-trend')
  @ApiOperation({ summary: 'Get Portfolio Occupancy Rate & Lease Renewal Pipeline Report' })
  async getOccupancyTrendReport(@Query() query: ReportQueryDto) {
    const data = await this.reportsService.getOccupancyTrendReport(query);
    return {
      success: true,
      data,
    };
  }

  @Get('maintenance-sla')
  @ApiOperation({ summary: 'Get Maintenance Ticket Response Time & Vendor SLA Report' })
  async getMaintenanceSlaReport(@Query() query: ReportQueryDto) {
    const data = await this.reportsService.getMaintenanceSlaReport(query);
    return {
      success: true,
      data,
    };
  }

  @Get('deposit-liability')
  @ApiOperation({ summary: 'Get Security Deposit Escrow Liability & Bank Balance Report' })
  async getDepositLiabilityReport(@Query() query: ReportQueryDto) {
    const data = await this.reportsService.getDepositLiabilityReport(query);
    return {
      success: true,
      data,
    };
  }
}
