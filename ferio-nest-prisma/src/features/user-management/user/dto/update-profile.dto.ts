import { IsString, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Support Mode Enum
 */
export enum SupportMode {
  CALM = 'calm',
  ENCOURAGING = 'encouraging',
  LOGICAL = 'logical',
}

/**
 * Notification Style Enum
 */
export enum NotificationStyle {
  GENTLE = 'gentle',
  FIRM = 'firm',
  NEUTRAL = 'neutral',
}

/**
 * Update Profile DTO
 * For updating user profile preferences
 */
export class UpdateProfileDto {
  @ApiProperty({
    example: 'John Doe',
    description: 'User full name',
    required: false,
  })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({
    example: '+1234567890',
    description: 'Phone number',
    required: false,
  })
  @IsString()
  @IsOptional()
  phoneNumber?: string;

  @ApiProperty({
    example: 'calm',
    description: 'Support mode preference',
    enum: SupportMode,
    required: false,
  })
  @IsEnum(SupportMode)
  @IsOptional()
  supportMode?: SupportMode;

  @ApiProperty({
    example: 'gentle',
    description: 'Notification style preference',
    enum: NotificationStyle,
    required: false,
  })
  @IsEnum(NotificationStyle)
  @IsOptional()
  notificationStyle?: NotificationStyle;
}
