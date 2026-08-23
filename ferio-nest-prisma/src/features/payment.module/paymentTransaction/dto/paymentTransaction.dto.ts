import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsMongoId,
  IsEnum,
  IsNumber,
  IsOptional,
  Min,
} from 'class-validator';
import { Currency, PaymentGateway, PaymentStatus, TransactionType } from '../../payment/constants/payment.constants';

/**
 * DTO for creating a payment transaction
 * Used when recording a new payment
 */
export class CreatePaymentTransactionDto {
  @ApiProperty({ description: 'User ID', example: '507f1f77bcf86cd799439011' })
  @IsNotEmpty({ message: 'User ID is required' })
  @IsMongoId({ message: 'Invalid user ID format' })
  userId: string;

  @ApiProperty({
    description: 'What the payment is for',
    enum: TransactionType,
    example: TransactionType.UserSubscription,
  })
  @IsNotEmpty({ message: 'referenceFor is required' })
  @IsEnum(TransactionType, { message: 'Invalid referenceFor' })
  referenceFor: TransactionType;

  @ApiProperty({ description: 'Reference entity ID', example: '507f1f77bcf86cd799439011' })
  @IsNotEmpty({ message: 'referenceId is required' })
  @IsMongoId({ message: 'Invalid referenceId format' })
  referenceId: string;

  @ApiProperty({
    description: 'Payment gateway',
    enum: PaymentGateway,
    example: PaymentGateway.stripe,
  })
  @IsNotEmpty({ message: 'paymentGateway is required' })
  @IsEnum(PaymentGateway, { message: 'Invalid paymentGateway' })
  paymentGateway: PaymentGateway;

  @ApiPropertyOptional({ description: 'Transaction ID from gateway' })
  @IsOptional()
  @IsString()
  transactionId?: string;

  @ApiPropertyOptional({ description: 'Payment intent ID (Stripe)' })
  @IsOptional()
  @IsString()
  paymentIntent?: string;

  @ApiProperty({ description: 'Payment amount', example: 2999 })
  @IsNotEmpty({ message: 'Amount is required' })
  @IsNumber({}, { message: 'Amount must be a number' })
  @Min(0, { message: 'Amount must be greater than zero' })
  amount: number;

  @ApiProperty({
    description: 'Currency',
    enum: Currency,
    example: Currency.usd,
  })
  @IsNotEmpty({ message: 'Currency is required' })
  @IsEnum(Currency, { message: 'Invalid currency' })
  currency: Currency;

  @ApiPropertyOptional({
    description: 'Payment status',
    enum: PaymentStatus,
    example: PaymentStatus.pending,
  })
  @IsOptional()
  @IsEnum(PaymentStatus, { message: 'Invalid paymentStatus' })
  paymentStatus?: PaymentStatus;

  @ApiPropertyOptional({ description: 'RevenueCat order ID' })
  @IsOptional()
  @IsString()
  revenueCatOrderId?: string;

  @ApiPropertyOptional({
    description: 'RevenueCat environment',
    enum: ['production', 'sandbox'],
  })
  @IsOptional()
  @IsString()
  revenueCatEnvironment?: 'production' | 'sandbox';

  @ApiPropertyOptional({
    description: 'Platform',
    enum: ['ios', 'android', 'web'],
  })
  @IsOptional()
  @IsString()
  platform?: 'ios' | 'android' | 'web';

  @ApiPropertyOptional({ description: 'Gateway response (full response from gateway)' })
  @IsOptional()
  gatewayResponse?: Record<string, any>;
}

/**
 * DTO for updating payment status
 * Used when webhook confirms payment completion
 */
export class UpdatePaymentStatusDto {
  @ApiProperty({
    description: 'New payment status',
    enum: PaymentStatus,
    example: PaymentStatus.completed,
  })
  @IsNotEmpty({ message: 'Status is required' })
  @IsEnum(PaymentStatus, { message: 'Invalid status' })
  status: PaymentStatus;

  @ApiPropertyOptional({ description: 'Gateway response' })
  @IsOptional()
  gatewayResponse?: Record<string, any>;
}

/**
 * DTO for querying payment transactions
 * Used for filtering and pagination
 */
export class QueryPaymentTransactionDto {
  @ApiPropertyOptional({
    description: 'Filter by payment status',
    enum: PaymentStatus,
  })
  @IsOptional()
  @IsEnum(PaymentStatus, { message: 'Invalid status' })
  status?: PaymentStatus;

  @ApiPropertyOptional({
    description: 'Filter by payment gateway',
    enum: PaymentGateway,
  })
  @IsOptional()
  @IsEnum(PaymentGateway, { message: 'Invalid gateway' })
  gateway?: PaymentGateway;

  @ApiPropertyOptional({ description: 'Filter by reference type' })
  @IsOptional()
  @IsEnum(TransactionType, { message: 'Invalid referenceFor' })
  referenceFor?: TransactionType;

  @ApiPropertyOptional({ description: 'Page number', example: 1 })
  @IsOptional()
  @IsNumber()
  page?: number;

  @ApiPropertyOptional({ description: 'Items per page', example: 10 })
  @IsOptional()
  @IsNumber()
  limit?: number;

  @ApiPropertyOptional({ description: 'Sort field', example: '-createdAt' })
  @IsOptional()
  @IsString()
  sortBy?: string;
}
