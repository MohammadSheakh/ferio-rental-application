import { IsString, IsNotEmpty, IsOptional, IsEnum, IsNumber, Min, IsDateString, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum UtilityType {
  ELECTRICITY = 'ELECTRICITY',
  WATER = 'WATER',
  GAS = 'GAS',
  GENERATOR = 'GENERATOR',
  INTERNET = 'INTERNET',
  COMMON_AREA = 'COMMON_AREA',
  OTHER = 'OTHER',
}

export enum UtilityBillingStrategy {
  TENANT_DIRECT = 'TENANT_DIRECT',
  OWNER_INCLUDED = 'OWNER_INCLUDED',
  FIXED_CHARGE = 'FIXED_CHARGE',
  INDIVIDUAL_METER = 'INDIVIDUAL_METER',
  SHARED_METER = 'SHARED_METER',
  MANUAL_ALLOCATION = 'MANUAL_ALLOCATION',
}

export enum SharedAllocationMethod {
  EQUAL_SPLIT = 'EQUAL_SPLIT',
  OCCUPANT_COUNT = 'OCCUPANT_COUNT',
  FLOOR_AREA = 'FLOOR_AREA',
  CONFIGURED_PERCENTAGE = 'CONFIGURED_PERCENTAGE',
  SUBMETER_CONSUMPTION = 'SUBMETER_CONSUMPTION',
}

export class CreateUtilityAccountDto {
  @ApiProperty({ example: 'org-uuid-v4' })
  @IsString()
  @IsNotEmpty()
  organizationId: string;

  @ApiProperty({ example: 'property-uuid-v4' })
  @IsString()
  @IsNotEmpty()
  propertyId: string;

  @ApiPropertyOptional({ example: 'building-uuid-v4' })
  @IsString()
  @IsOptional()
  buildingId?: string;

  @ApiProperty({ enum: UtilityType, example: UtilityType.ELECTRICITY })
  @IsEnum(UtilityType)
  utilityType: UtilityType;

  @ApiProperty({ enum: UtilityBillingStrategy, example: UtilityBillingStrategy.INDIVIDUAL_METER })
  @IsEnum(UtilityBillingStrategy)
  billingStrategy: UtilityBillingStrategy;

  @ApiProperty({ example: 'DESCO / DPDC' })
  @IsString()
  @IsNotEmpty()
  providerName: string;

  @ApiProperty({ example: 'MTR-88771122' })
  @IsString()
  @IsNotEmpty()
  accountNumber: string;
}

export class RecordMeterReadingDto {
  @ApiProperty({ example: 'meter-uuid-v4' })
  @IsString()
  @IsNotEmpty()
  meterId: string;

  @ApiProperty({ example: '2026-08-22T00:00:00.000Z' })
  @IsDateString()
  readingDate: string;

  @ApiProperty({ example: 1450.5 })
  @IsNumber()
  @Min(0)
  currentReading: number;

  @ApiPropertyOptional({ example: 'Monthly DESCO meter reading recorded by Caretaker' })
  @IsString()
  @IsOptional()
  notes?: string;
}

export class AllocateUtilityBillDto {
  @ApiProperty({ example: 'utility-account-uuid-v4' })
  @IsString()
  @IsNotEmpty()
  utilityAccountId: string;

  @ApiProperty({ example: '2026-08' })
  @IsString()
  @IsNotEmpty()
  period: string;

  @ApiProperty({ example: 12500.00 })
  @IsNumber()
  @Min(0)
  totalBillAmount: number;

  @ApiProperty({ enum: SharedAllocationMethod, example: SharedAllocationMethod.FLOOR_AREA })
  @IsEnum(SharedAllocationMethod)
  allocationMethod: SharedAllocationMethod;
}
