import { IsString, IsNotEmpty, IsOptional, IsEnum, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum InspectionType {
  MOVE_IN = 'MOVE_IN',
  MOVE_OUT = 'MOVE_OUT',
  PERIODIC = 'PERIODIC',
  MAINTENANCE = 'MAINTENANCE',
  SAFETY = 'SAFETY',
}

export enum ConditionState {
  EXCELLENT = 'EXCELLENT',
  GOOD = 'GOOD',
  FAIR = 'FAIR',
  DAMAGED = 'DAMAGED',
  MISSING = 'MISSING',
  NOT_APPLICABLE = 'NOT_APPLICABLE',
}

export class InspectionItemDto {
  @ApiProperty({ example: 'Living Room — Ceiling Fan & Light' })
  @IsString()
  @IsNotEmpty()
  itemName: string;

  @ApiProperty({ enum: ConditionState, example: ConditionState.GOOD })
  @IsEnum(ConditionState)
  condition: ConditionState;

  @ApiPropertyOptional({ example: 'Minor scuff marks on blade 2' })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional({ example: ['https://storage.ferio.com/inspections/fan-01.jpg'] })
  @IsArray()
  @IsOptional()
  photos?: string[];
}

export class CreateInspectionDto {
  @ApiProperty({ example: 'org-uuid-v4' })
  @IsString()
  @IsNotEmpty()
  organizationId: string;

  @ApiProperty({ example: 'property-uuid-v4' })
  @IsString()
  @IsNotEmpty()
  propertyId: string;

  @ApiProperty({ example: 'unit-uuid-v4' })
  @IsString()
  @IsNotEmpty()
  unitId: string;

  @ApiPropertyOptional({ example: 'lease-uuid-v4' })
  @IsString()
  @IsOptional()
  leaseId?: string;

  @ApiProperty({ enum: InspectionType, example: InspectionType.MOVE_IN })
  @IsEnum(InspectionType)
  inspectionType: InspectionType;

  @ApiProperty({ type: [InspectionItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InspectionItemDto)
  items: InspectionItemDto[];
}
