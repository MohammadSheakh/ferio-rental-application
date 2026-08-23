import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

import { UserRoleDataService } from './userRoleData.service';
import { CreateUserRoleDataDto, UpdateUserRoleDataDto } from './dto/userRoleData.dto';
import { AuthGuard, RolesGuard, Roles, TransformResponseInterceptor } from '@app/common';

@ApiTags('User Role Data')
@Controller('user-role-data')
@UseGuards(AuthGuard, RolesGuard)
@UseInterceptors(TransformResponseInterceptor)
@ApiBearerAuth()
export class UserRoleDataController {
  constructor(private readonly userRoleDataService: UserRoleDataService) {}

  @Get('paginate')
  @ApiOperation({ summary: 'Get all user role data with pagination' })
  async getAllWithPagination(@Query() query: any) {
    return this.userRoleDataService.paginate(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user role data by ID' })
  async getById(@Param('id') id: string) {
    return this.userRoleDataService.findById(id);
  }

  @Put('update/:id')
  @ApiOperation({ summary: 'Update user role data' })
  async updateById(
    @Param('id') id: string,
    @Body() updateDto: UpdateUserRoleDataDto,
  ) {
    return this.userRoleDataService.updateById(id, updateDto);
  }

  @Get()
  @Roles('common', 'commonAdmin')
  @ApiOperation({ summary: 'Get all user role data' })
  async getAll() {
    return this.userRoleDataService.findAll();
  }

  @Post('create')
  @Roles('common', 'commonAdmin')
  @ApiOperation({ summary: 'Create user role data' })
  async create(@Body() createDto: CreateUserRoleDataDto) {
    return this.userRoleDataService.create(createDto);
  }

  @Delete('delete/:id')
  @ApiOperation({ summary: 'Hard delete user role data' })
  async deleteById(@Param('id') id: string) {
    return this.userRoleDataService.deleteById(id);
  }

  @Put('softDelete/:id')
  @ApiOperation({ summary: 'Soft delete user role data' })
  async softDeleteById(@Param('id') id: string) {
    return this.userRoleDataService.softDelete(id);
  }
}
