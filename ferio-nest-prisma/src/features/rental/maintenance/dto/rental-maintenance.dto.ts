import { IsString, IsNotEmpty, IsOptional, IsEnum, IsNumber, Min, IsArray, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RentalMaintenanceCategory, RentalMaintenanceUrgency, RentalMaintenanceStatus, RentalWorkOrderStatus } from '@prisma/client';

export class CreateMaintenanceRequestDto {
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

  @ApiProperty({ example: 'person-uuid-v4', description: 'Reporter person ID (tenant/staff)' })
  @IsString()
  @IsNotEmpty()
  reporterPersonId: string;

  @ApiProperty({ enum: RentalMaintenanceCategory, example: RentalMaintenanceCategory.PLUMBING })
  @IsEnum(RentalMaintenanceCategory)
  category: RentalMaintenanceCategory;

  @ApiPropertyOptional({ enum: RentalMaintenanceUrgency, default: RentalMaintenanceUrgency.NORMAL })
  @IsEnum(RentalMaintenanceUrgency)
  @IsOptional()
  urgency?: RentalMaintenanceUrgency;

  @ApiProperty({ example: 'Water pipe leakage under bathroom sink.' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiPropertyOptional({ example: ['https://storage.ferio.com/photos/leak-01.jpg'] })
  @IsArray()
  @IsOptional()
  photos?: string[];

  @ApiPropertyOptional({ example: 'wamid.HBgLODgwMTcxMjM0NTY3OA==' })
  @IsString()
  @IsOptional()
  whatsappMessageId?: string;
}

export class CreateVendorProfileDto {
  @ApiProperty({ example: 'org-uuid-v4' })
  @IsString()
  @IsNotEmpty()
  organizationId: string;

  @ApiProperty({ example: 'Dhaka Sanitary & Plumbing Works' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'Plumbing & Drainage Repair' })
  @IsString()
  @IsNotEmpty()
  specialty: string;

  @ApiProperty({ example: '+8801911223344' })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiPropertyOptional({ example: 'vendor@sanitary.com' })
  @IsString()
  @IsOptional()
  email?: string;
}

export class CreateWorkOrderDto {
  @ApiProperty({ example: 'request-uuid-v4' })
  @IsString()
  @IsNotEmpty()
  requestId: string;

  @ApiProperty({ example: 'vendor-uuid-v4' })
  @IsString()
  @IsNotEmpty()
  vendorId: string;

  @ApiPropertyOptional({ example: 3500.00 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  estimatedCost?: number;

  @ApiPropertyOptional({ example: '2026-08-26T10:00:00.000Z' })
  @IsDateString()
  @IsOptional()
  scheduledDate?: string;
}

export class UpdateWorkOrderStatusDto {
  @ApiProperty({ enum: RentalWorkOrderStatus, example: RentalWorkOrderStatus.COMPLETED })
  @IsEnum(RentalWorkOrderStatus)
  status: RentalWorkOrderStatus;

  @ApiPropertyOptional({ example: 3200.00 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  actualCost?: number;

  @ApiPropertyOptional({ example: 'Replaced rubber washer and seal.' })
  @IsString()
  @IsOptional()
  notes?: string;
}
