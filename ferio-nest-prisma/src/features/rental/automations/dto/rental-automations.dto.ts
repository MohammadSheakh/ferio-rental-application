import { IsString, IsNotEmpty, IsOptional, IsEnum, IsBoolean, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum TriggerType {
  INVOICE_OVERDUE = 'INVOICE_OVERDUE',
  LEASE_EXPIRING = 'LEASE_EXPIRING',
  MAINTENANCE_OPENED = 'MAINTENANCE_OPENED',
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  UNIT_VACANT = 'UNIT_VACANT',
}

export enum ActionType {
  SEND_WHATSAPP = 'SEND_WHATSAPP',
  SEND_EMAIL = 'SEND_EMAIL',
  CREATE_TASK = 'CREATE_TASK',
  INVOKE_WEBHOOK = 'INVOKE_WEBHOOK',
}

export class CreateAutomationRuleDto {
  @ApiProperty({ example: 'org-uuid-v4' })
  @IsString()
  @IsNotEmpty()
  organizationId: string;

  @ApiProperty({ example: 'Send WhatsApp Rent Reminder 3 Days Overdue' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ enum: TriggerType, example: TriggerType.INVOICE_OVERDUE })
  @IsEnum(TriggerType)
  triggerType: TriggerType;

  @ApiPropertyOptional({ example: { daysOverdue: 3, minAmount: 10000 } })
  @IsObject()
  @IsOptional()
  conditions?: Record<string, any>;

  @ApiProperty({ enum: ActionType, example: ActionType.SEND_WHATSAPP })
  @IsEnum(ActionType)
  actionType: ActionType;

  @ApiPropertyOptional({ example: { template: 'RENT_REMINDER', recipientRole: 'TENANT' } })
  @IsObject()
  @IsOptional()
  actionParams?: Record<string, any>;

  @ApiProperty({ example: true })
  @IsBoolean()
  enabled: boolean;
}

export class TriggerAutomationEventDto {
  @ApiProperty({ example: 'org-uuid-v4' })
  @IsString()
  @IsNotEmpty()
  organizationId: string;

  @ApiProperty({ enum: TriggerType, example: TriggerType.INVOICE_OVERDUE })
  @IsEnum(TriggerType)
  triggerType: TriggerType;

  @ApiProperty({ example: { invoiceId: 'inv-8899', amount: 45000, daysOverdue: 3, tenantPhone: '+8801711998877' } })
  @IsObject()
  eventData: Record<string, any>;
}
