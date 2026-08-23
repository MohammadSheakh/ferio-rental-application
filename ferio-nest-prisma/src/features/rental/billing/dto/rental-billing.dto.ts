import { IsString, IsNotEmpty, IsOptional, IsEnum, IsNumber, Min, IsDateString, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RentalChargeCategory, RentalPaymentMethod } from '@prisma/client';

export class InvoiceLineDto {
  @ApiProperty({ enum: RentalChargeCategory, example: RentalChargeCategory.RENT })
  @IsEnum(RentalChargeCategory)
  chargeCategory: RentalChargeCategory;

  @ApiProperty({ example: 'Base Rent for September 2026' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ example: 45000.00 })
  @IsNumber()
  @Min(0)
  amount: number;
}

export class CreateRentalInvoiceDto {
  @ApiProperty({ example: 'billing-account-uuid-v4' })
  @IsString()
  @IsNotEmpty()
  billingAccountId: string;

  @ApiProperty({ example: 'INV-2026-09-001' })
  @IsString()
  @IsNotEmpty()
  invoiceNumber: string;

  @ApiProperty({ example: '2026-09' })
  @IsString()
  @IsNotEmpty()
  period: string;

  @ApiProperty({ example: '2026-09-05T00:00:00.000Z' })
  @IsDateString()
  dueDate: string;

  @ApiProperty({ type: [InvoiceLineDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InvoiceLineDto)
  lines: InvoiceLineDto[];
}

export class RecordPaymentDto {
  @ApiProperty({ example: 'billing-account-uuid-v4' })
  @IsString()
  @IsNotEmpty()
  billingAccountId: string;

  @ApiProperty({ example: 'PAY-2026-09-001' })
  @IsString()
  @IsNotEmpty()
  paymentNumber: string;

  @ApiProperty({ example: 45000.00 })
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiProperty({ enum: RentalPaymentMethod, example: RentalPaymentMethod.BKASH })
  @IsEnum(RentalPaymentMethod)
  paymentMethod: RentalPaymentMethod;

  @ApiPropertyOptional({ example: 'BKASH-TXN-99887766' })
  @IsString()
  @IsOptional()
  providerReference?: string;

  @ApiPropertyOptional({ example: 'invoice-uuid-v4', description: 'Target invoice ID to allocate payment to' })
  @IsString()
  @IsOptional()
  targetInvoiceId?: string;
}

export class VerifyCashPaymentDto {
  @ApiProperty({ example: true, description: 'Approve or reject cash collection' })
  approved: boolean;

  @ApiPropertyOptional({ example: 'Verified cash handed over by Caretaker Rafiq' })
  @IsString()
  @IsOptional()
  notes?: string;
}

export class RecordDepositTransactionDto {
  @ApiProperty({ example: 'lease-uuid-v4' })
  @IsString()
  @IsNotEmpty()
  leaseId: string;

  @ApiProperty({ example: 'COLLECTION', enum: ['COLLECTION', 'DEDUCTION', 'REFUND'] })
  @IsString()
  @IsNotEmpty()
  type: 'COLLECTION' | 'DEDUCTION' | 'REFUND';

  @ApiProperty({ example: 90000.00 })
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiPropertyOptional({ example: 'Refunded security deposit upon lease exit after inspection' })
  @IsString()
  @IsOptional()
  notes?: string;
}
