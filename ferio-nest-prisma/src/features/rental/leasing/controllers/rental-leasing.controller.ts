import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RentalLeasingService } from '../services/rental-leasing.service';
import { CreateRentalLeaseDto, AddLeasePartyDto } from '../dto/rental-lease.dto';
import { AuthGuard } from '@app/common';

@ApiTags('Rental - Leases & Occupancy')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('api/rental/leases')
export class RentalLeasingController {
  constructor(private readonly leasingService: RentalLeasingService) {}

  @Post()
  @ApiOperation({ summary: 'Create a draft lease agreement' })
  async createLease(@Body() createDto: CreateRentalLeaseDto) {
    const data = await this.leasingService.createLease(createDto);
    return {
      success: true,
      message: 'Draft Lease created successfully.',
      data,
    };
  }

  @Post('parties')
  @ApiOperation({ summary: 'Add a co-tenant, occupant, or guarantor to a lease' })
  async addLeaseParty(@Body() addPartyDto: AddLeasePartyDto) {
    const data = await this.leasingService.addLeaseParty(addPartyDto);
    return {
      success: true,
      message: 'Lease party added successfully.',
      data,
    };
  }

  @Post(':id/activate')
  @ApiOperation({ summary: 'Atomically activate lease, set unit to OCCUPIED, and setup billing/deposit accounts' })
  async activateLease(@Param('id') id: string) {
    const data = await this.leasingService.activateLease(id);
    return {
      success: true,
      message: `Lease '${data.leaseNumber}' activated successfully. Unit status changed to OCCUPIED.`,
      data,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get lease details with parties, unit, and billing accounts' })
  async findLeaseById(@Param('id') id: string) {
    const data = await this.leasingService.findLeaseById(id);
    return {
      success: true,
      data,
    };
  }
}
