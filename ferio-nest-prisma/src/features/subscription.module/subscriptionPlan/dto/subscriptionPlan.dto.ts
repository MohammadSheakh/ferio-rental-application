import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsEnum,
  IsNumber,
  IsBoolean,
  IsOptional,
  Min,
  MaxLength,
  MinLength,
  IsArray,
  ArrayMinSize,
} from 'class-validator';
import {
  SubscriptionType,
  InitialDuration,
  RenewalFrequency,
  PurchaseChannel,
  Platform,
} from '../constants/subscriptionPlan.constants';
import { Currency } from '../../../enums/payment';

/**
 * DTO for creating a subscription plan
 * Used by admin to create new subscription tiers
 */
export class CreateSubscriptionPlanDto {
  @ApiProperty({
    description: 'Subscription plan name',
    example: 'Individual Monthly',
    minLength: 2,
    maxLength: 100,
  })
  @IsNotEmpty({ message: 'Subscription name is required' })
  @IsString({ message: 'Subscription name must be a string' })
  @MinLength(2, { message: 'Name must be at least 2 characters' })
  @MaxLength(100, { message: 'Name cannot exceed 100 characters' })
  subscriptionName: string;

  @ApiProperty({
    description: 'Subscription type',
    enum: SubscriptionType,
    example: SubscriptionType.individual,
  })
  @IsNotEmpty({ message: 'Subscription type is required' })
  @IsEnum(SubscriptionType, {
    message: 'Invalid subscription type',
  })
  subscriptionType: SubscriptionType;

  @ApiPropertyOptional({
    description: 'Free trial enabled',
    example: true,
  })
  @IsOptional()
  @IsBoolean({ message: 'freeTrialEnabled must be a boolean' })
  freeTrialEnabled?: boolean;

  @ApiPropertyOptional({
    description: 'Free trial duration in days',
    example: 7,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber({}, { message: 'freeTrialDurationDays must be a number' })
  @Min(0, { message: 'Free trial duration must be non-negative' })
  freeTrialDurationDays?: number;

  @ApiPropertyOptional({
    description: 'Initial duration',
    enum: InitialDuration,
    example: InitialDuration.month,
  })
  @IsOptional()
  @IsEnum(InitialDuration, { message: 'Invalid initial duration' })
  initialDuration?: InitialDuration;

  @ApiPropertyOptional({
    description: 'Renewal frequency',
    enum: RenewalFrequency,
    example: RenewalFrequency.monthly,
  })
  @IsOptional()
  @IsEnum(RenewalFrequency, { message: 'Invalid renewal frequency' })
  renewalFrequncy?: RenewalFrequency;

  @ApiProperty({
    description: 'Subscription amount',
    example: '29.99',
  })
  @IsNotEmpty({ message: 'Amount is required' })
  @IsString({ message: 'Amount must be a string' })
  amount: string;

  @ApiPropertyOptional({
    description: 'Currency',
    enum: Currency,
    example: Currency.usd,
  })
  @IsOptional()
  @IsEnum(Currency, { message: 'Invalid currency' })
  currency?: Currency;

  @ApiProperty({
    description: 'Maximum children accounts allowed',
    example: 5,
  })
  @IsNotEmpty({ message: 'maxChildrenAccount is required' })
  @IsNumber({}, { message: 'maxChildrenAccount must be a number' })
  @Min(1, { message: 'Must allow at least 1 child account' })
  maxChildrenAccount: number;

  @ApiPropertyOptional({
    description: 'Purchase channel',
    enum: PurchaseChannel,
    example: PurchaseChannel.stripe,
  })
  @IsOptional()
  @IsEnum(PurchaseChannel, { message: 'Invalid purchase channel' })
  purchaseChannel?: PurchaseChannel;

  @ApiPropertyOptional({
    description: 'RevenueCat product identifier',
    example: 'individual_monthly',
  })
  @IsOptional()
  @IsString({ message: 'revenueCatProductIdentifier must be a string' })
  revenueCatProductIdentifier?: string;

  @ApiPropertyOptional({
    description: 'RevenueCat package identifier',
    example: 'monthly',
  })
  @IsOptional()
  @IsString({ message: 'revenueCatPackageIdentifier must be a string' })
  revenueCatPackageIdentifier?: string;

  @ApiPropertyOptional({
    description: 'Available platforms',
    enum: Platform,
    isArray: true,
    example: [Platform.web],
  })
  @IsOptional()
  @IsArray({ message: 'availablePlatforms must be an array' })
  @ArrayMinSize(1, { message: 'Must have at least 1 platform' })
  @IsEnum(Platform, { each: true, message: 'Invalid platform' })
  availablePlatforms?: Platform[];

  @ApiPropertyOptional({
    description: 'Is active',
    example: true,
  })
  @IsOptional()
  @IsBoolean({ message: 'isActive must be a boolean' })
  isActive?: boolean;
}

/**
 * DTO for updating a subscription plan
 */
export class UpdateSubscriptionPlanDto {
  @ApiPropertyOptional({
    description: 'Subscription plan name',
    example: 'Individual Monthly',
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  subscriptionName?: string;

  @ApiPropertyOptional({
    description: 'Subscription amount',
    example: '39.99',
  })
  @IsOptional()
  @IsString()
  amount?: string;

  @ApiPropertyOptional({
    description: 'Free trial enabled',
  })
  @IsOptional()
  @IsBoolean()
  freeTrialEnabled?: boolean;

  @ApiPropertyOptional({
    description: 'Free trial duration in days',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  freeTrialDurationDays?: number;

  @ApiPropertyOptional({
    description: 'Maximum children accounts',
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  maxChildrenAccount?: number;

  @ApiPropertyOptional({
    description: 'Is active',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'RevenueCat product identifier',
  })
  @IsOptional()
  @IsString()
  revenueCatProductIdentifier?: string;

  @ApiPropertyOptional({
    description: 'RevenueCat package identifier',
  })
  @IsOptional()
  @IsString()
  revenueCatPackageIdentifier?: string;
}
