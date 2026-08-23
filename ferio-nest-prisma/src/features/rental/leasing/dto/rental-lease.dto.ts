import { IsString, IsNotEmpty, IsOptional, IsEnum, IsNumber, Min, IsDateString, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RentalBillingFrequency, RentalLeasePartyRole } from '@prisma/client';

export class CreateRentalLeaseDto {
  @ApiProperty({ example: 'org-uuid-v4' })
  @IsString()
  @IsNotEmpty()
  organizationId: string;

  @ApiProperty({ example: 'unit-uuid-v4' })
  @IsString()
  @IsNotEmpty()
  unitId: string;

  @ApiPropertyOptional({ example: 'app-uuid-v4' })
  @IsString()
  @IsOptional()
  applicationId?: string;

  @ApiProperty({ example: 'LEASE-2026-0001' })
  @IsString()
  @IsNotEmpty()
  leaseNumber: string;

  @ApiProperty({ example: '2026-09-01T00:00:00.000Z' })
  @IsDateString()
  startDate: string;

  @ApiProperty({ example: '2027-08-31T00:00:00.000Z' })
  @IsDateString()
  endDate: string;

  @ApiProperty({ example: 45000.00 })
  @IsNumber()
  @Min(0)
  rentAmount: number;

  @ApiPropertyOptional({ example: 5000.00, default: 0 })
  @IsNumber()
  @IsOptional()
  serviceCharge?: number;

  @ApiPropertyOptional({ example: 90000.00, default: 0 })
  @IsNumber()
  @IsOptional()
  securityDeposit?: number;

  @ApiPropertyOptional({ enum: RentalBillingFrequency, default: RentalBillingFrequency.MONTHLY })
  @IsEnum(RentalBillingFrequency)
  @IsOptional()
  billingFrequency?: RentalBillingFrequency;

  @ApiPropertyOptional({ example: 5, default: 5 })
  @IsNumber()
  @IsOptional()
  dueDay?: number;

  @ApiPropertyOptional({ example: 5, default: 5 })
  @IsNumber()
  @IsOptional()
  gracePeriodDays?: number;

  @ApiPropertyOptional({ example: 30, default: 30 })
  @IsNumber()
  @IsOptional()
  noticePeriodDays?: number;

  @ApiProperty({ example: 'person-uuid-v4', description: 'Primary tenant person ID' })
  @IsString()
  @IsNotEmpty()
  primaryTenantPersonId: string;
}

export class AddLeasePartyDto {
  @ApiProperty({ example: 'lease-uuid-v4' })
  @IsString()
  @IsNotEmpty()
  leaseId: string;

  @ApiProperty({ example: 'person-uuid-v4' })
  @IsString()
  @IsNotEmpty()
  personId: string;

  @ApiProperty({ enum: RentalLeasePartyRole, example: RentalLeasePartyRole.CO_TENANT })
  @IsEnum(RentalLeasePartyRole)
  role: RentalLeasePartyRole;

  @ApiPropertyOptional({ example: true, default: true })
  @IsBoolean()
  @IsOptional()
  financiallyResponsible?: boolean;

  @ApiPropertyOptional({ example: true, default: true })
  @IsBoolean()
  @IsOptional()
  isOccupant?: boolean;
}
