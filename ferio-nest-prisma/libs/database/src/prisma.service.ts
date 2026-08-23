import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { StructuredLogger } from '@app/common';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  [key: string]: any;
  private readonly logger = new StructuredLogger(PrismaService.name);

  constructor() {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const adapter = new PrismaPg(pool);
    super({ adapter });
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('database_connection_established', {
        database: 'postgresql',
      });
    } catch (error) {
      this.logger.error('database_connection_failed', error, {
        database: 'postgresql',
      });
      throw error;
    }
  }
}
