import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient as ControlPrismaClient } from '@prisma/control-client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

/**
 * Control Plane Prisma Service
 *
 * Manages the connection to the central Control Plane database.
 * Contains: SaaS organizations, subscriptions, tenant DB registry,
 * plans, feature flags, provisioning jobs, and platform audit events.
 *
 * Prisma 7 requires driver adapters instead of datasourceUrl.
 */
@Injectable()
export class ControlPlanePrismaService
  extends ControlPrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(ControlPlanePrismaService.name);

  constructor() {
    const pool = new Pool({
      connectionString: process.env.CONTROL_PLANE_DATABASE_URL,
      max: parseInt(process.env.CONTROL_PLANE_POOL_MAX || '10', 10),
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
    this.logger.log('✅ Control Plane database connected');
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('🔌 Control Plane database disconnected');
  }
}
