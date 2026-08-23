import { Controller, Get, Post, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RentalUtilitiesService } from '../services/rental-utilities.service';
import { CreateUtilityAccountDto, RecordMeterReadingDto, AllocateUtilityBillDto } from '../dto/rental-utilities.dto';
import { AuthGuard } from '@app/common';

@ApiTags('Rental - Utilities & Metering Apportionment')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('api/rental/utilities')
export class RentalUtilitiesController {
  constructor(private readonly utilitiesService: RentalUtilitiesService) {}

  @Post('accounts')
  @ApiOperation({ summary: 'Register a Utility Account (DESCO, WASA, Titas Gas) for a property' })
  async createUtilityAccount(@Body() dto: CreateUtilityAccountDto) {
    const data = await this.utilitiesService.createUtilityAccount(dto);
    return {
      success: true,
      message: `Utility account for ${dto.providerName} registered successfully.`,
      data,
    };
  }

  @Post('meter-readings')
  @ApiOperation({ summary: 'Record monthly meter reading (Electricity, Gas, Generator)' })
  async recordMeterReading(@Body() dto: RecordMeterReadingDto, @Request() req: any) {
    const userId = req.user?.id || req.user?.sub;
    const data = await this.utilitiesService.recordMeterReading(dto, userId);
    return {
      success: true,
      message: `Meter reading for meter '${dto.meterId}' recorded successfully.`,
      data,
    };
  }

  @Post('allocate-bill')
  @ApiOperation({ summary: 'Apportion shared utility bill across units (Equal Split, Floor Area %, Occupants)' })
  async allocateUtilityBill(@Body() dto: AllocateUtilityBillDto) {
    const data = await this.utilitiesService.allocateUtilityBill(dto);
    return {
      success: true,
      message: `Utility bill allocated across units successfully using ${dto.allocationMethod}.`,
      data,
    };
  }

  @Get('property/:propertyId')
  @ApiOperation({ summary: 'Get utility accounts and meter setup for a property' })
  async getUtilityAccountsByProperty(@Param('propertyId') propertyId: string) {
    const data = await this.utilitiesService.getUtilityAccountsByProperty(propertyId);
    return {
      success: true,
      data,
    };
  }
}
