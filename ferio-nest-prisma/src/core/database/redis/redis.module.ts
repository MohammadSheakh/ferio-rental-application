import { Module, Global } from '@nestjs/common';
import { RedisProvider, RedisPubProvider, RedisSubProvider } from './redis.provider';

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
 * 
 * Usage:
 * constructor(@Inject(REDIS_CLIENT) private redisClient: RedisClientType) {}
 */
@Global()
@Module({
  providers: [RedisProvider, RedisPubProvider, RedisSubProvider],
  exports: [RedisProvider, RedisPubProvider, RedisSubProvider],
})
export class RedisModule {}
