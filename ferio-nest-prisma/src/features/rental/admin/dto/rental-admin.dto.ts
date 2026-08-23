import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum AccountStatus {
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  PENDING_VERIFICATION = 'PENDING_VERIFICATION',
}

export class UpdateOrganizationStatusDto {
  @ApiProperty({ enum: AccountStatus, example: AccountStatus.SUSPENDED })
  @IsEnum(AccountStatus)
  status: AccountStatus;

  @ApiPropertyOptional({ example: 'Subscription payment past due 30 days' })
  @IsString()
  @IsOptional()
  reason?: string;
}

export class SetFeatureFlagDto {
  @ApiProperty({ example: 'WHATSAPP_SANDBOX_MODE' })
  @IsString()
  @IsNotEmpty()
  flagKey: string;

  @ApiProperty({ example: true })
  @IsBoolean()
  enabled: boolean;

  @ApiPropertyOptional({ example: 'org-uuid-v4' })
  @IsString()
  @IsOptional()
  targetOrganizationId?: string;
}
