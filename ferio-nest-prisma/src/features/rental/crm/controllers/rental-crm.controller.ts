import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RentalCrmService } from '../services/rental-crm.service';
import { CreateRentalLeadDto, ScheduleViewingDto, CreateRentalApplicationDto, AddGuarantorDto } from '../dto/rental-crm.dto';
import { AuthGuard } from '@app/common';

@ApiTags('Rental - Leads, Viewings & Screening CRM')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('api/rental/crm')
export class RentalCrmController {
  constructor(private readonly crmService: RentalCrmService) {}

  @Post('leads')
  @ApiOperation({ summary: 'Register a prospective tenant lead' })
  async createLead(@Body() createDto: CreateRentalLeadDto) {
    const data = await this.crmService.createLead(createDto);
    return {
      success: true,
      message: 'Lead registered successfully.',
      data,
    };
  }

  @Post('viewings')
  @ApiOperation({ summary: 'Schedule a property/unit viewing for a lead' })
  async scheduleViewing(@Body() dto: ScheduleViewingDto) {
    const data = await this.crmService.scheduleViewing(dto);
    return {
      success: true,
      message: 'Viewing scheduled successfully.',
      data,
    };
  }

  @Post('applications')
  @ApiOperation({ summary: 'Submit a tenant rental application with default BD verification checklists' })
  async createApplication(@Body() createDto: CreateRentalApplicationDto) {
    const data = await this.crmService.createApplication(createDto);
    return {
      success: true,
      message: 'Rental application submitted successfully.',
      data,
    };
  }

  @Post('guarantors')
  @ApiOperation({ summary: 'Add a guarantor to a tenant rental application' })
  async addGuarantor(@Body() addGuarantorDto: AddGuarantorDto) {
    const data = await this.crmService.addGuarantor(addGuarantorDto);
    return {
      success: true,
      message: 'Guarantor attached successfully.',
      data,
    };
  }

  @Get('applications/:id')
  @ApiOperation({ summary: 'Get full application detail with guarantors and verification checklists' })
  async findApplicationById(@Param('id') id: string) {
    const data = await this.crmService.findApplicationById(id);
    return {
      success: true,
      data,
    };
  }
}
