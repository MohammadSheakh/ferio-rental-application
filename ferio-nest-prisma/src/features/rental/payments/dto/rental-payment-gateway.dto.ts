import { IsString, IsNotEmpty, IsOptional, IsEnum, IsNumber, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum MfsGatewayProvider {
  BKASH = 'BKASH',
  NAGAD = 'NAGAD',
  ROCKET = 'ROCKET',
  UPAY = 'UPAY',
  CITY_BANK = 'CITY_BANK',
}

export class InitiateMfsPaymentDto {
  @ApiProperty({ example: 'org-uuid-v4' })
  @IsString()
  @IsNotEmpty()
  organizationId: string;

  @ApiProperty({ example: 'acc-uuid-v4' })
  @IsString()
  @IsNotEmpty()
  billingAccountId: string;

  @ApiPropertyOptional({ example: 'inv-uuid-v4' })
  @IsString()
  @IsOptional()
  targetInvoiceId?: string;

  @ApiProperty({ enum: MfsGatewayProvider, example: MfsGatewayProvider.BKASH })
  @IsEnum(MfsGatewayProvider)
  provider: MfsGatewayProvider;

  @ApiProperty({ example: 45000.0 })
  @IsNumber()
  @Min(1)
  amount: number;

  @ApiProperty({ example: '+8801711998877' })
  @IsString()
  @IsNotEmpty()
  payerPhone: string;
}

export class MfsWebhookPayloadDto {
  @ApiProperty({ example: 'BKASH-TXN-99887766' })
  @IsString()
  @IsNotEmpty()
  trxId: string;

  @ApiProperty({ example: '45000.00' })
  @IsString()
  @IsNotEmpty()
  amount: string;

  @ApiProperty({ example: 'Completed' })
  @IsString()
  @IsNotEmpty()
  transactionStatus: string;

  @ApiProperty({ example: '2026-08-22T15:30:00.000Z' })
  @IsString()
  @IsNotEmpty()
  dateTime: string;

  @ApiPropertyOptional({ example: 'sig-sha256-hash-ref' })
  @IsString()
  @IsOptional()
  signature?: string;
}
