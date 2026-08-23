import { Module, Global } from '@nestjs/common';
import { RedisProvider, RedisPubProvider, RedisSubProvider } from './redis.provider';
import { RedisService } from './redis.service';

/**
 * Redis Module
 * 
 * 📚 INDUSTRY STANDARD IMPLEMENTATION
 * 
 * Global module providing Redis client to all other modules
 * 
 * Features:
 * ✅ Global module (no need to import in other modules)
 * ✅ Configurable via environment variables
 * ✅ Automatic reconnection
 * ✅ Health check support
 * ✅ Centralized RedisService helper
 * 
 * Usage:
 * constructor(private redisService: RedisService) {}
 */
@Global()
@Module({
  providers: [RedisProvider, RedisPubProvider, RedisSubProvider, RedisService],
  exports: [RedisProvider, RedisPubProvider, RedisSubProvider, RedisService],
})
export class RedisModule {}
