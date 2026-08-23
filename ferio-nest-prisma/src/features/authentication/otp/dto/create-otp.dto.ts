import { IsEmail, IsNotEmpty, IsString, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO for creating OTP
 * Used for email verification and password reset
 */
export class CreateOtpDto {
  @ApiProperty({
    example: 'user@example.com',
    description: 'Email address to send OTP',
  })
  @IsEmail({}, { message: 'Invalid email format' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  @ApiProperty({
    example: 'verify',
    description: 'OTP type: verify (email verification) or reset (password reset)',
    enum: ['verify', 'reset'],
  })
  @IsString()
  @IsNotEmpty({ message: 'OTP type is required' })
  type: 'verify' | 'reset';
}

/**
 * DTO for verifying OTP
 */
export class VerifyOtpDto {
  @ApiProperty({
    example: 'user@example.com',
    description: 'Email address',
  })
  @IsEmail({}, { message: 'Invalid email format' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  @ApiProperty({
    example: '123456',
    description: 'OTP code',
    minLength: 6,
    maxLength: 6,
  })
  @IsString()
  @IsNotEmpty({ message: 'OTP is required' })
  @MinLength(6, { message: 'OTP must be 6 digits' })
  @MaxLength(6, { message: 'OTP must be 6 digits' })
  otp: string;

  @ApiProperty({
    example: 'verify',
    description: 'OTP type',
    enum: ['verify', 'reset'],
  })
  @IsString()
  @IsNotEmpty({ message: 'OTP type is required' })
  type: 'verify' | 'reset';
}
