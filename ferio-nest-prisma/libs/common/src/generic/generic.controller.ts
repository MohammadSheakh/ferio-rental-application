import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PaginateOptions } from '../shared/types/paginate';
import { GenericService } from './generic.service';

/**
 * Generic Prisma controller.
 *
 * Supports simple CRUD routes and Prisma-style `include` / `select` query strings:
 * `?include=profile,wallet` or `?select=id,email,name`.
 */
@Controller()
@ApiTags('Generic')
export class GenericController<TDelegate = any, TRecord = any> {
  protected modelName: string;

  constructor(
    protected service: GenericService<TDelegate, TRecord>,
    modelName: string,
  ) {
    this.modelName = modelName;
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get record by ID' })
  @ApiParam({ name: 'id', description: 'Record ID' })
  @ApiResponse({ status: 200, description: 'Record retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Record not found' })
  async getById(
    @Param('id') id: string,
    @Query('include') include?: string,
    @Query('populate') populate?: string,
    @Query('select') select?: string,
  ) {
    return await this.service.findById(
      id,
      this.parseInclude(include || populate),
      this.parseSelect(select),
    );
  }

  @Get()
  @ApiOperation({ summary: 'Get all records' })
  @ApiResponse({ status: 200, description: 'Records retrieved successfully' })
  async getAll(
    @Query() filters?: Record<string, any>,
    @Query('include') include?: string,
    @Query('populate') populate?: string,
    @Query('select') select?: string,
  ) {
    return await this.service.findAll(
      filters,
      this.parseInclude(include || populate),
      this.parseSelect(select),
    );
  }

  @Get('paginate')
  @ApiOperation({ summary: 'Get records with pagination' })
  @ApiResponse({ status: 200, description: 'Records retrieved successfully' })
  async getAllWithPagination(
    @Query() filters?: Record<string, any>,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('sortBy') sortBy?: string,
    @Query('include') include?: string,
    @Query('populate') populate?: string,
    @Query('select') select?: string,
  ) {
    const options: PaginateOptions = {
      page: Number(page) || 1,
      limit: Number(limit) || 10,
      sortBy: sortBy || '-createdAt',
    };

    return await this.service.findAllWithPagination(
      filters,
      options,
      this.parseInclude(include || populate),
      this.parseSelect(select),
    );
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create record' })
  @ApiResponse({ status: 201, description: 'Record created successfully' })
  async create(@Body() data: Record<string, any>) {
    return await this.service.create(data);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update record by ID' })
  @ApiParam({ name: 'id', description: 'Record ID' })
  @ApiResponse({ status: 200, description: 'Record updated successfully' })
  @ApiResponse({ status: 404, description: 'Record not found' })
  async updateById(@Param('id') id: string, @Body() data: Record<string, any>) {
    return await this.service.updateById(id, data);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete record by ID' })
  @ApiParam({ name: 'id', description: 'Record ID' })
  @ApiResponse({ status: 204, description: 'Record deleted successfully' })
  @ApiResponse({ status: 404, description: 'Record not found' })
  async deleteById(@Param('id') id: string) {
    await this.service.deleteById(id);
    return null;
  }

  @Delete(':id/soft')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft delete record by ID' })
  @ApiParam({ name: 'id', description: 'Record ID' })
  @ApiResponse({ status: 204, description: 'Record soft deleted successfully' })
  @ApiResponse({ status: 404, description: 'Record not found' })
  async softDeleteById(@Param('id') id: string) {
    await this.service.softDeleteById(id);
    return null;
  }

  @Get('count')
  @ApiOperation({ summary: 'Count records' })
  @ApiResponse({ status: 200, description: 'Record count retrieved' })
  async count(@Query() filters?: Record<string, any>) {
    return await this.service.count(filters);
  }

  private parseInclude(include?: string): Record<string, true> | undefined {
    if (!include) {
      return undefined;
    }

    return Object.fromEntries(
      include.split(',').map((field) => [field.trim(), true]),
    );
  }

  private parseSelect(select?: string): Record<string, boolean> | undefined {
    if (!select) {
      return undefined;
    }

    return Object.fromEntries(
      select.split(',').map((field) => [field.trim(), true]),
    );
  }
}
