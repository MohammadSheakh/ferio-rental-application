import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from './config/config.module';
import { RedisModule } from '@app/redis';
import { AuthModule } from './features/authentication/auth.module';
import { UserModule } from './features/user-management/user.module';
import { MarketplaceModule } from './features/marketplace/marketplace.module';
import { TenantOperationsModule } from './features/tenant-operations/tenant-operations.module';
import { RenterPortalModule } from './features/renter-portal/renter-portal.module';
import { OwnerPortalModule } from './features/owner-portal/owner-portal.module';
import { PrismaModule } from '@app/database';
import { BullMQModule } from '@app/queue';
import { PlatformInfrastructureModule } from './infrastructure/platform-infrastructure.module';
import { IdentityModule } from './infrastructure/identity/identity.module';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    RedisModule,
    BullMQModule,

    // ── Three-Plane Platform Infrastructure ──
    PlatformInfrastructureModule,

    // ── Central Identity (§10) ──
    IdentityModule,

    // ── Central Marketplace ──
    MarketplaceModule,

    // ── SaaS Tenant Operations ──
    TenantOperationsModule,

    // ── Renter Portal (Week 28) ──
    RenterPortalModule,

    // ── Unit Owner Portal (Week 29) ──
    OwnerPortalModule,

    // ── Feature Modules ──
    AuthModule,
    UserModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
