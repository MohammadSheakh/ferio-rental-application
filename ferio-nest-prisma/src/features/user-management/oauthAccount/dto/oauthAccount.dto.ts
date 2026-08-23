import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsEmail,
  IsOptional,
  IsEnum,
} from 'class-validator';
import { OAuthProvider } from '@prisma/client';

/**
 * DTO for creating OAuth account
 */
export class CreateOAuthAccountDto {
  @ApiProperty({ description: 'User ID', example: '507f1f77bcf86cd799439011' })
  @IsNotEmpty({ message: 'User ID is required' })
  @IsString({ message: 'User ID must be a string' })
  userId: string;

  @ApiProperty({
    description: 'OAuth provider',
    enum: OAuthProvider,
    example: OAuthProvider.google,
  })
  @IsNotEmpty({ message: 'Provider is required' })
  @IsEnum(OAuthProvider, { message: 'Invalid provider' })
  authProvider: OAuthProvider;

  @ApiProperty({ description: 'Provider user ID', example: 'google_123456' })
  @IsNotEmpty({ message: 'Provider user ID is required' })
  @IsString({ message: 'Provider user ID must be a string' })
  providerId: string;

  @ApiProperty({ description: 'Email from provider' })
  @IsNotEmpty({ message: 'Email is required' })
  @IsEmail({}, { message: 'Invalid email format' })
  email: string;

  @ApiPropertyOptional({ description: 'Access token' })
  @IsOptional()
  @IsString()
  accessToken?: string;

  @ApiPropertyOptional({ description: 'Refresh token' })
  @IsOptional()
  @IsString()
  refreshToken?: string;

  @ApiPropertyOptional({ description: 'ID token' })
  @IsOptional()
  @IsString()
  idToken?: string;
}

/**
 * DTO for updating OAuth account
 */
export class UpdateOAuthAccountDto {
  @ApiPropertyOptional({ description: 'Access token' })
  @IsOptional()
  @IsString()
  accessToken?: string;

  @ApiPropertyOptional({ description: 'Refresh token' })
  @IsOptional()
  @IsString()
  refreshToken?: string;

  @ApiPropertyOptional({ description: 'ID token' })
  @IsOptional()
  @IsString()
  idToken?: string;
}
