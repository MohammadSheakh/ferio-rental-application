import { IsString, IsNotEmpty, IsOptional, IsArray, IsEnum, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum ImportEntityType {
  PROPERTIES = 'PROPERTIES',
  UNITS = 'UNITS',
  OWNERS = 'OWNERS',
  TENANTS = 'TENANTS',
  LEASES = 'LEASES',
  OPENING_BALANCES = 'OPENING_BALANCES',
}

export class ImportRowDto {
  @ApiProperty({ example: 1 })
  rowNumber: number;

  @ApiProperty({ example: { propertyName: 'Rose Valley', unitNumber: 'A-1', rentAmount: 45000, tenantName: 'Tanvir Hossain' } })
  rowData: Record<string, any>;
}

export class ValidateImportBatchDto {
  @ApiProperty({ example: 'org-uuid-v4' })
  @IsString()
  @IsNotEmpty()
  organizationId: string;

  @ApiProperty({ enum: ImportEntityType, example: ImportEntityType.UNITS })
  @IsEnum(ImportEntityType)
  entityType: ImportEntityType;

  @ApiProperty({ type: [ImportRowDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportRowDto)
  rows: ImportRowDto[];
}

export class ExecuteImportBatchDto {
  @ApiProperty({ example: 'job-imp-9988' })
  @IsString()
  @IsNotEmpty()
  importJobId: string;
}
