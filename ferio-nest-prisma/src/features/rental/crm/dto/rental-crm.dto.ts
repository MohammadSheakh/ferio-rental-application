import { IsString, IsNotEmpty, IsOptional, IsEnum, IsNumber, Min, IsDateString, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RentalLeadSource, RentalLeadStatus, RentalViewingStatus, RentalGuarantorType, RentalVerificationType } from '@prisma/client';

export class CreateRentalLeadDto {
  @ApiProperty({ example: 'org-uuid-v4' })
  @IsString()
  @IsNotEmpty()
  organizationId: string;

  @ApiProperty({ example: 'person-uuid-v4' })
  @IsString()
  @IsNotEmpty()
  personId: string;

  @ApiPropertyOptional({ example: 'unit-uuid-v4' })
  @IsString()
  @IsOptional()
  interestedUnitId?: string;

  @ApiPropertyOptional({ enum: RentalLeadSource, default: RentalLeadSource.WALK_IN })
  @IsEnum(RentalLeadSource)
  @IsOptional()
  source?: RentalLeadSource;

  @ApiPropertyOptional({ example: 35000.00 })
  @IsNumber()
  @IsOptional()
  budgetMin?: number;

  @ApiPropertyOptional({ example: 45000.00 })
  @IsNumber()
  @IsOptional()
  budgetMax?: number;

  @ApiPropertyOptional({ example: '2026-09-01T00:00:00.000Z' })
  @IsDateString()
  @IsOptional()
  expectedMoveIn?: string;

  @ApiPropertyOptional({ example: 4 })
  @IsNumber()
  @IsOptional()
  familySize?: number;

  @ApiPropertyOptional({ example: 'Software Engineer at Grameenphone' })
  @IsString()
  @IsOptional()
  occupation?: string;
}

export class ScheduleViewingDto {
  @ApiProperty({ example: 'lead-uuid-v4' })
  @IsString()
  @IsNotEmpty()
  leadId: string;

  @ApiProperty({ example: 'unit-uuid-v4' })
  @IsString()
  @IsNotEmpty()
  unitId: string;

  @ApiProperty({ example: '2026-08-25T14:30:00.000Z' })
  @IsDateString()
  scheduledAt: string;
}

export class CreateRentalApplicationDto {
  @ApiProperty({ example: 'org-uuid-v4' })
  @IsString()
  @IsNotEmpty()
  organizationId: string;

  @ApiProperty({ example: 'unit-uuid-v4' })
  @IsString()
  @IsNotEmpty()
  unitId: string;

  @ApiProperty({ example: 'person-uuid-v4', description: 'Applicant person ID' })
  @IsString()
  @IsNotEmpty()
  applicantPersonId: string;

  @ApiProperty({ example: 42000.00 })
  @IsNumber()
  @Min(0)
  offeredRent: number;

  @ApiProperty({ example: '2026-09-01T00:00:00.000Z' })
  @IsDateString()
  expectedMoveIn: string;

  @ApiPropertyOptional({ example: 'Senior Financial Analyst' })
  @IsString()
  @IsOptional()
  occupation?: string;

  @ApiPropertyOptional({ example: 'BRAC Bank Ltd' })
  @IsString()
  @IsOptional()
  employer?: string;

  @ApiPropertyOptional({ example: 120000.00 })
  @IsNumber()
  @IsOptional()
  monthlyIncome?: number;

  @ApiPropertyOptional({ example: 'Rafiqul Islam' })
  @IsString()
  @IsOptional()
  previousLandlordName?: string;

  @ApiPropertyOptional({ example: '+8801811223344' })
  @IsString()
  @IsOptional()
  previousLandlordPhone?: string;
}

export class AddGuarantorDto {
  @ApiProperty({ example: 'application-uuid-v4' })
  @IsString()
  @IsNotEmpty()
  applicationId: string;

  @ApiProperty({ example: 'person-uuid-v4' })
  @IsString()
  @IsNotEmpty()
  personId: string;

  @ApiProperty({ example: 'Uncle / Community Leader' })
  @IsString()
  @IsNotEmpty()
  relationship: string;

  @ApiPropertyOptional({ enum: RentalGuarantorType, default: RentalGuarantorType.FAMILY })
  @IsEnum(RentalGuarantorType)
  @IsOptional()
  guarantorType?: RentalGuarantorType;

  @ApiPropertyOptional({ example: 'https://storage.ferio.com/guarantors/proof-123.pdf' })
  @IsString()
  @IsOptional()
  incomeProofUrl?: string;
}
