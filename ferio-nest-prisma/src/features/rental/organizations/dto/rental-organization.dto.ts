import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RentalOrgStatus } from '@prisma/client';

export class CreateRentalOrganizationDto {
  @ApiProperty({ description: 'Name of the rental organization', example: 'Dhaka Prime Properties' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Unique organization code', example: 'DHAKA-PRIME' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiPropertyOptional({ enum: RentalOrgStatus, default: RentalOrgStatus.ACTIVE })
  @IsEnum(RentalOrgStatus)
  @IsOptional()
  status?: RentalOrgStatus;

  @ApiPropertyOptional({ example: 'BDT', default: 'BDT' })
  @IsString()
  @IsOptional()
  currency?: string;

  @ApiPropertyOptional({ example: 'Asia/Dhaka', default: 'Asia/Dhaka' })
  @IsString()
  @IsOptional()
  timezone?: string;
}

export class UpdateRentalOrganizationDto {
  @ApiPropertyOptional({ example: 'Dhaka Prime Properties Ltd' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ enum: RentalOrgStatus })
  @IsEnum(RentalOrgStatus)
  @IsOptional()
  status?: RentalOrgStatus;

  @ApiPropertyOptional({ example: 'Asia/Dhaka' })
  @IsString()
  @IsOptional()
  timezone?: string;
}
