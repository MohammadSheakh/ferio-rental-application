import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RentalPeopleService } from '../services/rental-people.service';
import { CreateRentalPersonDto, CreateRentalOwnerProfileDto, AssignPropertyOwnershipDto } from '../dto/rental-person.dto';
import { AuthGuard } from '@app/common';

@ApiTags('Rental - People & Owners')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('api/rental/people')
export class RentalPeopleController {
  constructor(private readonly peopleService: RentalPeopleService) {}

  @Post()
  @ApiOperation({ summary: 'Register a new person in the organization directory' })
  async createPerson(@Body() createDto: CreateRentalPersonDto) {
    const data = await this.peopleService.createPerson(createDto);
    return {
      success: true,
      message: 'Person created successfully.',
      data,
    };
  }

  @Get()
  @ApiOperation({ summary: 'Get all people in an organization' })
  async findAllPeople(@Query('organizationId') organizationId: string) {
    const data = await this.peopleService.findAllPeople(organizationId);
    return {
      success: true,
      data,
    };
  }

  @Post('owners')
  @ApiOperation({ summary: 'Create an owner profile for a person' })
  async createOwnerProfile(@Body() createOwnerDto: CreateRentalOwnerProfileDto) {
    const data = await this.peopleService.createOwnerProfile(createOwnerDto);
    return {
      success: true,
      message: 'Owner profile created successfully.',
      data,
    };
  }

  @Post('ownerships')
  @ApiOperation({ summary: 'Assign property co-ownership percentage to an owner' })
  async assignPropertyOwnership(@Body() dto: AssignPropertyOwnershipDto) {
    const data = await this.peopleService.assignPropertyOwnership(dto);
    return {
      success: true,
      message: 'Property ownership assigned successfully.',
      data,
    };
  }
}
