import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { IdentityService } from './identity.service';
import { IdentityController } from './identity.controller';
import { JwtStrategy } from './jwt.strategy';
import { ACCESS_TTL, JWT_SECRET } from './identity.constants';

/**
 * Central Identity Module (§10)
 *
 * Registers/logs in users against the CONTROL PLANE database and
 * issues HS256 access tokens. Exported guards protect tenant,
 * marketplace-moderation and platform-admin surfaces.
 */
@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: JWT_SECRET,
      signOptions: { expiresIn: ACCESS_TTL },
    }),
  ],
  controllers: [IdentityController],
  providers: [IdentityService, JwtStrategy],
  exports: [JwtModule, IdentityService],
})
export class IdentityModule {}
