import { IsString, IsNotEmpty, IsOptional, IsEnum, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum CommunicationChannel {
  WHATSAPP = 'WHATSAPP',
  SMS = 'SMS',
  EMAIL = 'EMAIL',
  IN_APP = 'IN_APP',
  PHONE_LOG = 'PHONE_LOG',
  MANUAL_NOTE = 'MANUAL_NOTE',
}

export enum MessageTemplateType {
  RENT_REMINDER = 'RENT_REMINDER',
  INVOICE_ISSUED = 'INVOICE_ISSUED',
  PAYMENT_CONFIRMATION = 'PAYMENT_CONFIRMATION',
  MAINTENANCE_CREATED = 'MAINTENANCE_CREATED',
  TECHNICIAN_ASSIGNED = 'TECHNICIAN_ASSIGNED',
  LEASE_EXPIRY = 'LEASE_EXPIRY',
  RENEWAL_OFFER = 'RENEWAL_OFFER',
}

export class SendWhatsAppMessageDto {
  @ApiProperty({ example: 'org-uuid-v4' })
  @IsString()
  @IsNotEmpty()
  organizationId: string;

  @ApiProperty({ example: 'person-uuid-v4' })
  @IsString()
  @IsNotEmpty()
  recipientPersonId: string;

  @ApiProperty({ example: '+8801711998877' })
  @IsString()
  @IsNotEmpty()
  recipientPhone: string;

  @ApiProperty({ enum: MessageTemplateType, example: MessageTemplateType.RENT_REMINDER })
  @IsEnum(MessageTemplateType)
  templateType: MessageTemplateType;

  @ApiPropertyOptional({ example: { tenantName: 'Tanvir', amount: '৳45,000', dueDate: '05 Sep 2026' } })
  @IsOptional()
  templateParams?: Record<string, any>;
}

export class WhatsAppInboundWebhookDto {
  @ApiProperty({ example: 'wamid.HBgLMzgwMTcxMTk5ODg3NxUCABEYEjA0MzYxMDU3Mzc1MUM4OTcA' })
  @IsString()
  @IsNotEmpty()
  whatsappMessageId: string;

  @ApiProperty({ example: '+8801711998877' })
  @IsString()
  @IsNotEmpty()
  fromPhone: string;

  @ApiProperty({ example: 'My living room light fixture stopped working' })
  @IsString()
  @IsNotEmpty()
  messageBody: string;

  @ApiPropertyOptional({ example: ['https://mmg.whatsapp.net/v/t62.7118-24/31102.jpg'] })
  @IsArray()
  @IsOptional()
  mediaUrls?: string[];
}
