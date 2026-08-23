import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RedisModule } from '@app/redis';
import { PrismaModule } from '@app/database';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthController } from './auth/auth.controller';
import { AuthService } from './auth/auth.service';
import { OtpService } from './otp/otp.service';
import { EmailService } from './email/email.service';
import { OAuthVerificationService } from './oauth/oauth-verification.service';
import { TwoFactorService } from './two-factor/two-factor.service';

/**
 * Auth Module
 *
 *
 * Key Features:
 * ✅ JWT authentication
 * ✅ Local (email/password) authentication
 * ✅ Redis-based OTP (NOT MongoDB)
 * ✅ Token blacklisting
 * ✅ Rate limiting
 */
@Module({
  imports: [
    // JWT Module
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
        signOptions: {
          expiresIn: configService.get<string>(
            'JWT_ACCESS_EXPIRY',
            '15m',
          ) as never,
        },
      }),
    }),

    // Passport Module
    PassportModule,

    // Redis Module (for OTP and token blacklist)
    RedisModule,
    PrismaModule,

    // Rate Limiting
    ThrottlerModule.forRoot([
      {
        ttl: 900000, // 15 minutes
        limit: 5, // 5 attempts
      },
    ]),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    OtpService,
    EmailService,
    OAuthVerificationService,
    TwoFactorService,
  ],
  exports: [AuthService, EmailService, JwtModule],
})
export class AuthModule {}
