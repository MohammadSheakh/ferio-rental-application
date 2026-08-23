import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { DeviceType } from '../enums/TDevice.enum';


/**
 * Register Device DTO
 */
export class RegisterDeviceDto {
  @ApiProperty({
    example: 'fcm-token-123456789',
    description: 'FCM push notification token',
  })
  @IsString()
  @IsNotEmpty({ message: 'FCM token is required' })
  fcmToken: string;

  @ApiProperty({
    example: 'web',
    description: 'Device type',
    enum: DeviceType,
  })
  @IsEnum(DeviceType, { message: 'Device type must be web, ios, android, or desktop' })
  @IsNotEmpty({ message: 'Device type is required' })
  deviceType: DeviceType;

  @ApiProperty({
    example: 'Chrome on Windows',
    description: 'Device name/model',
    required: false,
  })
  @IsString()
  @IsOptional()
  deviceName?: string;

  @ApiProperty({
    example: 'Windows 10',
    description: 'Device OS version',
    required: false,
  })
  @IsString()
  @IsOptional()
  deviceOsVersion?: string;

  @ApiProperty({
    example: '1.0.0',
    description: 'App version (for mobile)',
    required: false,
  })
  @IsString()
  @IsOptional()
  appVersion?: string;
}

/**
 * Update Push Settings DTO
 */
export class UpdatePushSettingsDto {
  @ApiProperty({
    example: true,
    description: 'Enable/disable push notifications',
  })
  @IsString()
  @IsNotEmpty()
  enabled: boolean;
}
