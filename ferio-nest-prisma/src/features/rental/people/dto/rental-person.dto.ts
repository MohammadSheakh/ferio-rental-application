import { IsString, IsNotEmpty, IsOptional, IsEmail, IsEnum, IsNumber, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RentalOwnerType } from '@prisma/client';

export class CreateRentalPersonDto {
  @ApiProperty({ example: 'org-uuid-v4' })
  @IsString()
  @IsNotEmpty()
  organizationId: string;

  @ApiProperty({ example: 'Mohammad' })
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty({ example: 'Sheakh' })
  @IsString()
  @IsNotEmpty()
  lastName: string;

  @ApiProperty({ example: '+8801712345678' })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiPropertyOptional({ example: 'mohammad@example.com' })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({ example: '19951234567890123' })
  @IsString()
  @IsOptional()
  nidPassport?: string;

  @ApiPropertyOptional({ example: 'Village: Uttarpara, Post: Dhaka' })
  @IsString()
  @IsOptional()
  permanentAddress?: string;

  @ApiPropertyOptional({ example: 'Father: 01711000000' })
  @IsString()
  @IsOptional()
  emergencyContact?: string;
}

export class CreateRentalOwnerProfileDto {
  @ApiProperty({ example: 'person-uuid-v4' })
  @IsString()
  @IsNotEmpty()
  personId: string;

  @ApiPropertyOptional({ enum: RentalOwnerType, default: RentalOwnerType.INDIVIDUAL })
  @IsEnum(RentalOwnerType)
  @IsOptional()
  ownerType?: RentalOwnerType;

  @ApiPropertyOptional({ example: 'Sheakh Properties Ltd' })
  @IsString()
  @IsOptional()
  companyName?: string;

  @ApiPropertyOptional({ example: 'Dutch-Bangla Bank' })
  @IsString()
  @IsOptional()
  bankName?: string;

  @ApiPropertyOptional({ example: '1234567890' })
  @IsString()
  @IsOptional()
  bankAccountNo?: string;

  @ApiPropertyOptional({ example: '090261234' })
  @IsString()
  @IsOptional()
  routingNo?: string;
}

export class AssignPropertyOwnershipDto {
  @ApiProperty({ example: 'property-uuid-v4' })
  @IsString()
  @IsNotEmpty()
  propertyId: string;

  @ApiProperty({ example: 'owner-profile-uuid-v4' })
  @IsString()
  @IsNotEmpty()
  ownerProfileId: string;

  @ApiProperty({ example: 50.0, description: 'Percentage of ownership (0-100)' })
  @IsNumber()
  @Min(0)
  @Max(100)
  ownershipPercentage: number;
}
