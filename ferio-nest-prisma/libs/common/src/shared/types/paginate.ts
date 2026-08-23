import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

/**
 * Paginate Options Interface
 * Used for pagination queries
 */
export interface PaginateOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  populate?: any;
  select?: string;
}

/**
 * Paginate Result Interface
 * Returned from paginated queries
 */
export interface PaginateResult<T> {
  docs: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/**
 * Cursor Paginate Options Interface
 */
export interface CursorPaginateOptions {
  limit?: number;
  cursor?: string;
  sortBy?: string;
}

/**
 * Cursor Paginate Result Interface
 */
export interface CursorPaginateResult<T> {
  docs: T[];
  nextCursor?: string;
  hasNextPage: boolean;
}

/**
 * Base Paginate Query DTO
 */
export class PaginateQueryDto {
  @ApiPropertyOptional({ description: 'Page number', minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Number of items per page', minimum: 1, default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10;

  @ApiPropertyOptional({ description: 'Sort field and order (e.g. -createdAt or createdAt)', default: '-createdAt' })
  @IsOptional()
  @IsString()
  sortBy?: string;
}

/**
 * Base Cursor Paginate Query DTO
 */
export class CursorPaginateQueryDto {
  @ApiPropertyOptional({ description: 'Number of items per page', minimum: 1, default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10;

  @ApiPropertyOptional({ description: 'Cursor for pagination (ID of the last item of the previous page)' })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({ description: 'Sort field and order', default: 'id' })
  @IsOptional()
  @IsString()
  sortBy?: string;
}
