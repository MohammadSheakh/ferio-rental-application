import { IsString, IsNotEmpty, IsOptional, IsEnum, IsNumber, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RentalPropertyType, RentalPropertyStatus, RentalUnitType, RentalUnitStatus } from '@prisma/client';

export class CreateRentalPropertyDto {
  @ApiProperty({ example: 'org-uuid-v4' })
  @IsString()
  @IsNotEmpty()
  organizationId: string;

  @ApiProperty({ example: 'Rose Valley Heights' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'PROP-RVH' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({ enum: RentalPropertyType, example: RentalPropertyType.RESIDENTIAL_BUILDING })
  @IsEnum(RentalPropertyType)
  propertyType: RentalPropertyType;

  @ApiProperty({ example: 'House 42, Road 11, Block D, Banani' })
  @IsString()
  @IsNotEmpty()
  address: string;

  @ApiProperty({ example: 'Dhaka' })
  @IsString()
  @IsNotEmpty()
  district: string;

  @ApiProperty({ example: 'Banani' })
  @IsString()
  @IsNotEmpty()
  area: string;

  @ApiPropertyOptional({ example: 23.7937 })
  @IsNumber()
  @IsOptional()
  latitude?: number;

  @ApiPropertyOptional({ example: 90.4047 })
  @IsNumber()
  @IsOptional()
  longitude?: number;
}

export class CreateRentalUnitDto {
  @ApiProperty({ example: 'property-uuid-v4' })
  @IsString()
  @IsNotEmpty()
  propertyId: string;

  @ApiPropertyOptional({ example: 'building-uuid-v4' })
  @IsString()
  @IsOptional()
  buildingId?: string;

  @ApiProperty({ example: 'A-4' })
  @IsString()
  @IsNotEmpty()
  unitNumber: string;

  @ApiPropertyOptional({ example: 4 })
  @IsNumber()
  @IsOptional()
  floor?: number;

  @ApiProperty({ enum: RentalUnitType, example: RentalUnitType.THREE_BEDROOM })
  @IsEnum(RentalUnitType)
  unitType: RentalUnitType;

  @ApiPropertyOptional({ example: 3 })
  @IsNumber()
  @IsOptional()
  bedrooms?: number;

  @ApiPropertyOptional({ example: 3 })
  @IsNumber()
  @IsOptional()
  bathrooms?: number;

  @ApiPropertyOptional({ example: 2 })
  @IsNumber()
  @IsOptional()
  balconies?: number;

  @ApiPropertyOptional({ example: 1850.5 })
  @IsNumber()
  @IsOptional()
  areaSqFt?: number;

  @ApiProperty({ example: 45000.00 })
  @IsNumber()
  @Min(0)
  marketRent: number;
}

export class UpdateRentalUnitStatusDto {
  @ApiProperty({ enum: RentalUnitStatus, example: RentalUnitStatus.MAINTENANCE_HOLD })
  @IsEnum(RentalUnitStatus)
  status: RentalUnitStatus;

  @ApiPropertyOptional({ example: 'Scheduled routine renovation before new lease' })
  @IsString()
  @IsOptional()
  reason?: string;
}
