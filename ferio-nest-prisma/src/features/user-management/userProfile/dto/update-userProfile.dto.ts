import { IsString, IsOptional, IsEnum, IsDateString } from 'class-validator';
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
 * Update UserProfile DTO
 */
export class UpdateUserProfileDto {
  @ApiProperty({
    example: 'New York, USA',
    description: 'User location',
    required: false,
  })
  @IsString()
  @IsOptional()
  location?: string;

  @ApiProperty({
    example: '1990-01-15',
    description: 'Date of birth',
    required: false,
  })
  @IsDateString()
  @IsOptional()
  dob?: string;

  @ApiProperty({
    example: 'Male',
    description: 'Gender',
    required: false,
  })
  @IsString()
  @IsOptional()
  gender?: string;

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
