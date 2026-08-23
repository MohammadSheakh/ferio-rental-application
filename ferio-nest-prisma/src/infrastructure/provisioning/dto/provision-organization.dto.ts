import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsEmail,
  IsOptional,
  Matches,
  Length,
} from 'class-validator';

export class ProvisionOrganizationDto {
  @ApiProperty({
    description: 'Organization display name',
    example: 'Rahman Properties',
  })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({
    description: 'Unique tenant subdomain slug',
    example: 'rahman',
  })
  @IsString()
  @IsNotEmpty()
  @Length(4, 32)
  @Matches(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/, {
    message:
      'Slug must be 4-32 characters, lowercase alphanumeric with hyphens, no leading/trailing hyphens',
  })
  slug!: string;

  @ApiProperty({ description: 'Central identity user ID of the owner' })
  @IsString()
  @IsNotEmpty()
  ownerUserId!: string;

  @ApiProperty({ description: 'Owner display name', example: 'Rahim Rahman' })
  @IsString()
  @IsNotEmpty()
  ownerName!: string;

  @ApiProperty({
    description: 'Owner email address',
    example: 'rahim@rahman.com',
  })
  @IsEmail()
  ownerEmail!: string;

  @ApiPropertyOptional({
    description: 'Subscription plan tier',
    example: 'STARTER',
  })
  @IsString()
  @IsOptional()
  planTier?: string;

  @ApiPropertyOptional({ description: 'Contact email' })
  @IsEmail()
  @IsOptional()
  contactEmail?: string;

  @ApiPropertyOptional({ description: 'Contact phone' })
  @IsString()
  @IsOptional()
  contactPhone?: string;
}
