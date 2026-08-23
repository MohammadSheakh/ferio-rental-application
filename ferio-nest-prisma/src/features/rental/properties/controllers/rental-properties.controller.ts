import { Controller, Get, Post, Body, Patch, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RentalPropertiesService } from '../services/rental-properties.service';
import { CreateRentalPropertyDto, CreateRentalUnitDto, UpdateRentalUnitStatusDto } from '../dto/rental-property.dto';
import { AuthGuard } from '@app/common';

@ApiTags('Rental - Properties & Units')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('api/rental/properties')
export class RentalPropertiesController {
  constructor(private readonly propertiesService: RentalPropertiesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new property' })
  async createProperty(@Body() createDto: CreateRentalPropertyDto) {
    const data = await this.propertiesService.createProperty(createDto);
    return {
      success: true,
      message: 'Property created successfully.',
      data,
    };
  }

  @Get()
  @ApiOperation({ summary: 'List all properties within an organization' })
  async findAllProperties(@Query('organizationId') organizationId: string) {
    const data = await this.propertiesService.findAllProperties(organizationId);
    return {
      success: true,
      data,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get property details with units and ownership' })
  async findPropertyById(@Param('id') id: string) {
    const data = await this.propertiesService.findPropertyById(id);
    return {
      success: true,
      data,
    };
  }

  @Post('units')
  @ApiOperation({ summary: 'Create a new unit within a property' })
  async createUnit(@Body() createUnitDto: CreateRentalUnitDto) {
    const data = await this.propertiesService.createUnit(createUnitDto);
    return {
      success: true,
      message: 'Unit created successfully.',
      data,
    };
  }

  @Patch('units/:id/status')
  @ApiOperation({ summary: 'Update unit status via state machine transition' })
  async updateUnitStatus(
    @Param('id') unitId: string,
    @Body() updateStatusDto: UpdateRentalUnitStatusDto,
  ) {
    const data = await this.propertiesService.updateUnitStatus(unitId, updateStatusDto);
    return {
      success: true,
      message: `Unit status updated to ${data.status}.`,
      data,
    };
  }
}
