// ConfigService wrapper

import { Injectable } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';

/**
 * Config Service
 * 
 * 📚 INDUSTRY STANDARD IMPLEMENTATION
 * 
 * Type-safe configuration service
 * Centralized access to environment variables
 * 
 * Usage:
 * constructor(private configService: ConfigService) {}
 * const databaseUrl = this.configService.getDatabaseUrl();
 */
@Injectable()
export class ConfigService {
  constructor(private configService: NestConfigService) {}

  getDatabaseUrl(): string {
    return this.configService.getOrThrow<string>('DATABASE_URL');
  }

  /**
   * Get Redis Host
   */
  getRedisHost(): string {
    return this.configService.get<string>('REDIS_HOST', 'localhost');
  }

  /**
   * Get Redis Port
   */
  getRedisPort(): number {
    return this.configService.get<number>('REDIS_PORT', 6379);
  }

  /**
   * Get JWT Access Secret
   */
  getJwtAccessSecret(): string {
    return this.configService.getOrThrow<string>('JWT_ACCESS_SECRET');
  }

  /**
   * Get JWT Refresh Secret
   */
  getJwtRefreshSecret(): string {
    return this.configService.getOrThrow<string>('JWT_REFRESH_SECRET');
  }

  /**
   * Get JWT Access Expiry
   */
  getJwtAccessExpiry(): string {
    return this.configService.get<string>('JWT_ACCESS_EXPIRY', '15m');
  }

  /**
   * Get JWT Refresh Expiry
   */
  getJwtRefreshExpiry(): string {
    return this.configService.get<string>('JWT_REFRESH_EXPIRY', '7d');
  }

  /**
   * Get Node Environment
   */
  getNodeEnv(): string {
    return this.configService.get<string>('NODE_ENV', 'development');
  }

  /**
   * Get Port
   */
  getPort(): number {
    return this.configService.get<number>('PORT', 6733);
  }

  /**
   * Get API Prefix
   */
  getApiPrefix(): string {
    return this.configService.get<string>('API_PREFIX', 'api/v1');
  }
}
