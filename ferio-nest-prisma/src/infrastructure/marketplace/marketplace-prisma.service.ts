import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient as MarketplacePrismaClient } from '@prisma/marketplace-client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

/**
 * Marketplace Plane Prisma Service
 *
 * Manages the connection to the central Marketplace database.
 * Contains: public property listings, seller/broker profiles,
 * inquiries, favorites, viewing requests, and moderation.
 *
 * Prisma 7 requires driver adapters instead of datasourceUrl.
 */
@Injectable()
export class MarketplacePrismaService
  extends MarketplacePrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(MarketplacePrismaService.name);

  constructor() {
    const pool = new Pool({
      connectionString: process.env.MARKETPLACE_DATABASE_URL,
      max: parseInt(process.env.MARKETPLACE_POOL_MAX || '20', 10),
    });
    super({
      adapter: new PrismaPg(pool),
      log:
        process.env.NODE_ENV === 'development'
          ? ['warn', 'error']
          : ['error'],
    } as any);
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('✅ Marketplace database connected');
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('🔌 Marketplace database disconnected');
  }
}
