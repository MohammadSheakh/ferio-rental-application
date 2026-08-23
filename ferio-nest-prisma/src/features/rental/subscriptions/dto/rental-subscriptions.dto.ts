import { IsString, IsNotEmpty, IsOptional, IsEnum, IsNumber, Min, IsBoolean, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum SubscriptionTier {
  STARTER = 'STARTER',
  GROWTH = 'GROWTH',
  ENTERPRISE = 'ENTERPRISE',
}

export enum SubscriptionStatus {
  TRIALING = 'TRIALING',
  ACTIVE = 'ACTIVE',
  PAST_DUE = 'PAST_DUE',
  CANCELED = 'CANCELED',
}

export class CreateSubscriptionPlanDto {
  @ApiProperty({ example: 'Growth Plan (50 Units)' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ enum: SubscriptionTier, example: SubscriptionTier.GROWTH })
  @IsEnum(SubscriptionTier)
  tier: SubscriptionTier;

  @ApiProperty({ example: 4999.0 })
  @IsNumber()
  @Min(0)
  monthlyPriceBdt: number;

  @ApiProperty({ example: 50 })
  @IsNumber()
  @Min(1)
  maxUnits: number;

  @ApiProperty({ example: 5 })
  @IsNumber()
  @Min(1)
  maxProperties: number;

  @ApiProperty({ example: 10 })
  @IsNumber()
  @Min(1)
  maxTeamMembers: number;

  @ApiProperty({ example: ['MFS_AUTOMATION', 'WHATSAPP_TEMPLATES', 'ADVANCED_ANALYTICS'] })
  @IsArray()
  enabledFeatures: string[];
}

export class SubscribeOrganizationDto {
  @ApiProperty({ example: 'org-uuid-v4' })
  @IsString()
  @IsNotEmpty()
  organizationId: string;

  @ApiProperty({ example: 'plan-growth-01' })
  @IsString()
  @IsNotEmpty()
  planId: string;

  @ApiProperty({ example: 'BKASH' })
  @IsString()
  paymentMethod: string;
}
