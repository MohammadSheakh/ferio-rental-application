import { Controller, Get, Post, Body, Patch, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RentalMaintenanceService } from '../services/rental-maintenance.service';
import { CreateMaintenanceRequestDto, CreateVendorProfileDto, CreateWorkOrderDto, UpdateWorkOrderStatusDto } from '../dto/rental-maintenance.dto';
import { AuthGuard } from '@app/common';

@ApiTags('Rental - Maintenance & Vendor Work Orders')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('api/rental/maintenance')
export class RentalMaintenanceController {
  constructor(private readonly maintenanceService: RentalMaintenanceService) {}

  @Post('requests')
  @ApiOperation({ summary: 'Create a maintenance repair request' })
  async createRequest(@Body() createDto: CreateMaintenanceRequestDto) {
    const data = await this.maintenanceService.createRequest(createDto);
    return {
      success: true,
      message: 'Maintenance request created successfully.',
      data,
    };
  }

  @Get('requests')
  @ApiOperation({ summary: 'List all maintenance requests within an organization' })
  async findAllRequests(@Query('organizationId') organizationId: string) {
    const data = await this.maintenanceService.findAllRequests(organizationId);
    return {
      success: true,
      data,
    };
  }

  @Post('vendors')
  @ApiOperation({ summary: 'Register a contractor/vendor profile (Plumbing, Electrical, HVAC)' })
  async createVendorProfile(@Body() createVendorDto: CreateVendorProfileDto) {
    const data = await this.maintenanceService.createVendorProfile(createVendorDto);
    return {
      success: true,
      message: 'Vendor profile created successfully.',
      data,
    };
  }

  @Post('work-orders')
  @ApiOperation({ summary: 'Dispatch a work order to a vendor for a maintenance request' })
  async createWorkOrder(@Body() createWorkOrderDto: CreateWorkOrderDto) {
    const data = await this.maintenanceService.createWorkOrder(createWorkOrderDto);
    return {
      success: true,
      message: 'Work order dispatched successfully.',
      data,
    };
  }

  @Patch('work-orders/:id/status')
  @ApiOperation({ summary: 'Update work order status and track actual costs' })
  async updateWorkOrderStatus(
    @Param('id') workOrderId: string,
    @Body() updateStatusDto: UpdateWorkOrderStatusDto,
  ) {
    const data = await this.maintenanceService.updateWorkOrderStatus(workOrderId, updateStatusDto);
    return {
      success: true,
      message: `Work order status updated to ${data.status}.`,
      data,
    };
  }
}
