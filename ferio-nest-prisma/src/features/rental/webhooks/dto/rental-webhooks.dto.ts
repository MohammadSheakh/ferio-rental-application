import { IsString, IsNotEmpty, IsOptional, IsArray, IsUrl, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum ApiKeyPermission {
  READ_ONLY = 'READ_ONLY',
  FULL_ACCESS = 'FULL_ACCESS',
}

export enum WebhookEventType {
  INVOICE_GENERATED = 'INVOICE_GENERATED',
  PAYMENT_RECEIVED = 'PAYMENT_RECEIVED',
  LEASE_ACTIVATED = 'LEASE_ACTIVATED',
  MAINTENANCE_CREATED = 'MAINTENANCE_CREATED',
  INSPECTION_COMPLETED = 'INSPECTION_COMPLETED',
}

export class CreateApiKeyDto {
  @ApiProperty({ example: 'org-uuid-v4' })
  @IsString()
  @IsNotEmpty()
  organizationId: string;

  @ApiProperty({ example: 'Accounting Software Sync Key' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ enum: ApiKeyPermission, example: ApiKeyPermission.FULL_ACCESS })
  @IsEnum(ApiKeyPermission)
  permission: ApiKeyPermission;
}

export class RegisterWebhookEndpointDto {
  @ApiProperty({ example: 'org-uuid-v4' })
  @IsString()
  @IsNotEmpty()
  organizationId: string;

  @ApiProperty({ example: 'https://api.myerp.com/ferio-webhooks' })
  @IsUrl()
  @IsNotEmpty()
  targetUrl: string;

  @ApiProperty({ example: ['PAYMENT_RECEIVED', 'INVOICE_GENERATED'] })
  @IsArray()
  subscribedEvents: WebhookEventType[];

  @ApiPropertyOptional({ example: 'whsec_8899aabbcc' })
  @IsString()
  @IsOptional()
  secret?: string;
}

export class DispatchTestWebhookDto {
  @ApiProperty({ example: 'wh-ep-101' })
  @IsString()
  @IsNotEmpty()
  endpointId: string;

  @ApiProperty({ enum: WebhookEventType, example: WebhookEventType.PAYMENT_RECEIVED })
  @IsEnum(WebhookEventType)
  eventType: WebhookEventType;
}
