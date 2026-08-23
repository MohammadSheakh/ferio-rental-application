import { Controller, Get, Post, Body, Patch, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RentalOrganizationsService } from '../services/rental-organizations.service';
import { CreateRentalOrganizationDto, UpdateRentalOrganizationDto } from '../dto/rental-organization.dto';
import { AuthGuard } from '@app/common';

@ApiTags('Rental - Organizations')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('api/rental/organizations')
export class RentalOrganizationsController {
  constructor(private readonly orgsService: RentalOrganizationsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new rental organization' })
  async create(@Body() createDto: CreateRentalOrganizationDto, @Request() req: any) {
    const userId = req.user?.id || req.user?.sub;
    const data = await this.orgsService.create(createDto, userId);
    return {
      success: true,
      message: 'Rental Organization created successfully.',
      data,
    };
  }

  @Get()
  @ApiOperation({ summary: 'Get all rental organizations accessible by the current user' })
  async findAll(@Request() req: any) {
    const userId = req.user?.id || req.user?.sub;
    const data = await this.orgsService.findAllForUser(userId);
    return {
      success: true,
      data,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get rental organization details by ID' })
  async findOne(@Param('id') id: string) {
    const data = await this.orgsService.findOne(id);
    return {
      success: true,
      data,
    };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update rental organization information' })
  async update(@Param('id') id: string, @Body() updateDto: UpdateRentalOrganizationDto) {
    const data = await this.orgsService.update(id, updateDto);
    return {
      success: true,
      message: 'Rental Organization updated successfully.',
      data,
    };
  }
}
