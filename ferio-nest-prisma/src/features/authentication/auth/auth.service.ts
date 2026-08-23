import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import {
  OAuthProvider as PrismaOAuthProvider,
  Prisma,
  UserAuthProvider,
  UserRole,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash } from 'crypto';

import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { OAuthLoginDto, OAuthProvider } from './dto/oauth-login.dto';
import { OtpService } from '../otp/otp.service';
import { EmailService } from '../email/email.service';
import { OAuthVerificationService } from '../oauth/oauth-verification.service';
import { RedisService } from '@app/redis';
import { PrismaService } from '@app/database';
import { OtpType } from '../otp/interfaces/otp-payload.interface';
import { StructuredLogger } from '@app/common';
import { TwoFactorService } from '../two-factor/two-factor.service';

const authUserSelect = {
  id: true,
  name: true,
  email: true,
  password: true,
  role: true,
  profileImageUrl: true,
  failedLoginAttempts: true,
  lockUntil: true,
  isDeleted: true,
  isEmailVerified: true,
  authProvider: true,
  staffAccessStatus: true,
  staffPermissions: true,
  staffSessionVersion: true,
  twoFactorEnabled: true,
  twoFactorSecretEncrypted: true,
  twoFactorRecoveryCodeHashes: true,
} satisfies Prisma.UserSelect;

type AuthUserRecord = Prisma.UserGetPayload<{
  select: typeof authUserSelect;
}>;

@Injectable()
export class AuthService {
  private readonly logger = new StructuredLogger(AuthService.name);
  private readonly TOKEN_BLACKLIST_PREFIX = 'blacklist:token:';
  private readonly TOKEN_BLACKLIST_TTL = 7 * 24 * 60 * 60; // 7 days
  private readonly MAX_LOGIN_ATTEMPTS = 5;
  private readonly LOGIN_LOCK_MINUTES = 15;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly otpService: OtpService,
    private readonly emailService: EmailService,
    private readonly oauthVerificationService: OAuthVerificationService,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
    private readonly twoFactorService: TwoFactorService,
  ) {}

  /**
   * Login user
   */
  async login(loginDto: LoginDto) {
    const user = await this.validateCredentials(loginDto, 'CUSTOMER');
    const tokens = await this.generateTokens(user);

    return {
      user: this.toPublicUser(user),
      ...tokens,
    };
  }

  async completeAdminTwoFactor(challengeToken: string, code: string) {
    let challenge: {
      userId?: string;
      purpose?: string;
      sessionVersion?: number;
    };
    try {
      challenge = await this.jwtService.verifyAsync(challengeToken, {
        secret: this.configService.getOrThrow<string>(
          'TWO_FACTOR_CHALLENGE_SECRET',
        ),
      });
    } catch {
      throw new UnauthorizedException(
        'Invalid or expired authentication challenge',
      );
    }
    if (challenge.purpose !== 'ADMIN_TWO_FACTOR' || !challenge.userId) {
      throw new UnauthorizedException('Invalid authentication challenge');
    }
    const user = await this.prisma.user.findUnique({
      where: { id: challenge.userId },
      select: authUserSelect,
    });
    if (
      !user ||
      user.isDeleted ||
      !user.twoFactorEnabled ||
      (user.role !== UserRole.admin && user.role !== UserRole.staff) ||
      (user.role === UserRole.staff && user.staffAccessStatus !== 'active') ||
      challenge.sessionVersion !== user.staffSessionVersion
    ) {
      throw new UnauthorizedException('Invalid authentication challenge');
    }
    if (!(await this.twoFactorService.verifyUserCode(user, code))) {
      this.logger.warn('authentication_two_factor_rejected', {
        reason: 'CODE_INVALID',
        userId: user.id,
      });
      throw new UnauthorizedException('Invalid authentication code');
    }
    const tokens = await this.generateTokens(user);
    return { user: this.toPublicUser(user), ...tokens };
  }

  async loginAdmin(loginDto: LoginDto) {
    const user = await this.validateCredentials(loginDto, 'ADMIN');

    if (user.role !== UserRole.admin && user.role !== UserRole.staff) {
      this.logger.warn('authentication_login_rejected', {
        method: 'PASSWORD',
        audience: 'ADMIN',
        reason: 'ROLE_NOT_ALLOWED',
        userId: user.id,
        role: user.role,
      });
      throw new UnauthorizedException('Admin access is required');
    }

    if (user.role === UserRole.staff && user.staffAccessStatus !== 'active') {
      this.logger.warn('authentication_login_rejected', {
        method: 'PASSWORD',
        audience: 'ADMIN',
        reason: 'STAFF_INACTIVE',
        userId: user.id,
      });
      throw new UnauthorizedException('Staff access is inactive');
    }

    if (user.twoFactorEnabled) {
      const challengeToken = await this.jwtService.signAsync(
        {
          sub: user.id,
          userId: user.id,
          purpose: 'ADMIN_TWO_FACTOR',
          sessionVersion: user.staffSessionVersion,
        },
        {
          secret: this.configService.getOrThrow<string>(
            'TWO_FACTOR_CHALLENGE_SECRET',
          ),
          expiresIn: '5m',
        },
      );
      return { requiresTwoFactor: true as const, challengeToken };
    }

    const tokens = await this.generateTokens(user);

    return {
      user: this.toPublicUser(user),
      ...tokens,
    };
  }

  private async validateCredentials(
    loginDto: LoginDto,
    audience: 'CUSTOMER' | 'ADMIN',
  ): Promise<AuthUserRecord> {
    const identifier = loginDto.email.trim().toLowerCase();
    const digits = identifier.replace(/\D/g, '');
    const phoneNorm =
      digits.length >= 10
        ? digits.startsWith('880')
          ? '+' + digits
          : '+88' + (digits.startsWith('0') ? digits : '0' + digits)
        : null;

    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: identifier },
          ...(phoneNorm ? [{ phoneNumber: phoneNorm }] : []),
          { phoneNumber: identifier },
        ],
        isDeleted: false,
      },
      select: authUserSelect,
    });

    if (!user || !user.password) {
      this.logger.warn('authentication_login_rejected', {
        method: 'PASSWORD',
        audience,
        reason: 'INVALID_CREDENTIALS',
        accountMatched: Boolean(user),
        userId: user?.id,
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.lockUntil && user.lockUntil > new Date()) {
      this.logger.warn('authentication_login_rejected', {
        method: 'PASSWORD',
        audience,
        reason: 'ACCOUNT_LOCKED',
        userId: user.id,
        lockUntil: user.lockUntil,
      });
      throw new UnauthorizedException(
        'Account temporarily locked. Try again later',
      );
    }

    const isValid = await bcrypt.compare(loginDto.password, user.password);
    if (!isValid) {
      const failedLogin = await this.recordFailedLogin(user);
      this.logger.warn('authentication_login_rejected', {
        method: 'PASSWORD',
        audience,
        reason: 'INVALID_CREDENTIALS',
        accountMatched: true,
        userId: user.id,
        failedAttemptCount: failedLogin.attempts,
        lockApplied: failedLogin.locked,
        lockUntil: failedLogin.lockUntil,
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.role === UserRole.user && !user.isEmailVerified) {
      this.logger.warn('authentication_login_rejected', {
        method: 'PASSWORD',
        audience,
        reason: 'EMAIL_UNVERIFIED',
        userId: user.id,
      });
      throw new UnauthorizedException('Verify your email before signing in');
    }

    if (user.failedLoginAttempts > 0 || user.lockUntil) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: 0, lockUntil: null },
      });
    }

    return user;
  }

  private async recordFailedLogin(user: AuthUserRecord) {
    const attempts = user.failedLoginAttempts + 1;
    const shouldLock = attempts >= this.MAX_LOGIN_ATTEMPTS;
    const lockUntil = shouldLock
      ? new Date(Date.now() + this.LOGIN_LOCK_MINUTES * 60 * 1000)
      : null;

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: shouldLock ? 0 : attempts,
        lockUntil,
      },
    });

    return { attempts, locked: shouldLock, lockUntil };
  }

  private toPublicUser(user: AuthUserRecord) {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      profileImageUrl: user.profileImageUrl,
      permissions: user.role === UserRole.staff ? user.staffPermissions : [],
    };
  }

  /**
   * Register new user
   */
  async register(registerDto: RegisterDto) {
    const { name, email, password, phoneNumber } = registerDto;
    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    });

    if (existingUser) {
      throw new BadRequestException('Email already registered');
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await this.prisma.user.create({
      data: {
        name: name.trim(),
        email: normalizedEmail,
        password: hashedPassword,
        role: UserRole.user,
        phoneNumber: phoneNumber?.trim() || undefined,
        isEmailVerified: false,
      },
    });

    const otp = await this.otpService.createOtp(
      normalizedEmail,
      OtpType.VERIFY,
    );
    await this.emailService.sendOtpEmail(normalizedEmail, otp, OtpType.VERIFY);

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      message: 'Registration successful. Please verify your email.',
      ...(process.env.NODE_ENV === 'development' && { otp }),
    };
  }

  async verifyEmail(email: string, otp: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const existing = await this.prisma.user.findFirst({
      where: { email: normalizedEmail, isDeleted: false },
      select: { id: true, isEmailVerified: true },
    });
    if (!existing) {
      throw new BadRequestException('Invalid email or verification code');
    }
    if (existing.isEmailVerified) {
      throw new BadRequestException('Email is already verified');
    }

    await this.otpService.verifyOtp(normalizedEmail, otp, OtpType.VERIFY);
    const user = await this.prisma.user.update({
      where: { id: existing.id },
      data: { isEmailVerified: true },
      select: authUserSelect,
    });
    const tokens = await this.generateTokens(user);
    return { user: this.toPublicUser(user), ...tokens };
  }

  async resendEmailVerification(email: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.prisma.user.findFirst({
      where: { email: normalizedEmail, isDeleted: false },
      select: { id: true, isEmailVerified: true },
    });

    if (user && !user.isEmailVerified) {
      const otp = await this.otpService.createOtp(
        normalizedEmail,
        OtpType.VERIFY,
      );
      await this.emailService.sendOtpEmail(
        normalizedEmail,
        otp,
        OtpType.VERIFY,
      );
    }

    return {
      message:
        'If the account is awaiting verification, a new code has been sent',
    };
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string) {
    const client = await this.redisService.getClient();
    if (client) {
      const isBlacklisted = await client.get(
        this.getBlacklistKey(refreshToken),
      );
      if (isBlacklisted) {
        this.logger.warn('authentication_refresh_rejected', {
          reason: 'TOKEN_REVOKED',
        });
        throw new UnauthorizedException('Refresh token has been revoked');
      }
    }

    let payload: { userId?: string; sessionVersion?: number };
    try {
      payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch (error) {
      this.logger.warn('authentication_refresh_rejected', {
        reason: 'TOKEN_INVALID',
        errorName: error instanceof Error ? error.name : 'UnknownError',
      });
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (!payload.userId) {
      this.logger.warn('authentication_refresh_rejected', {
        reason: 'TOKEN_PAYLOAD_INVALID',
      });
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.userId },
      select: authUserSelect,
    });

    if (!user || user.isDeleted) {
      this.logger.warn('authentication_refresh_rejected', {
        reason: 'ACCOUNT_UNAVAILABLE',
        userId: payload.userId,
      });
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (
      user.role === UserRole.staff &&
      (user.staffAccessStatus !== 'active' ||
        payload.sessionVersion !== user.staffSessionVersion)
    ) {
      this.logger.warn('authentication_refresh_rejected', {
        reason: 'STAFF_ACCESS_CHANGED',
        userId: user.id,
      });
      throw new UnauthorizedException('Invalid refresh token');
    }

    const tokens = await this.generateTokens(user);
    await this.blacklistToken(refreshToken);

    return tokens;
  }

  /**
   * Logout user
   */
  async logout(refreshToken: string) {
    await this.blacklistToken(refreshToken);
    return { message: 'Logout successful' };
  }

  /**
   * Forgot password
   */
  async forgotPassword(email: string) {
    const user = await this.prisma.user.findFirst({
      where: { email: email.toLowerCase(), isDeleted: false },
      select: { id: true },
    });

    if (!user) {
      return {
        message: 'If the account exists, a password reset code has been sent',
      };
    }

    const otp = await this.otpService.createOtp(email, OtpType.RESET);
    await this.emailService.sendOtpEmail(email, otp, OtpType.RESET);

    return { message: 'Password reset OTP sent to your email' };
  }

  /**
   * Verify OTP
   */
  async verifyOtp(email: string, otp: string, type: OtpType) {
    return await this.otpService.verifyOtp(email, otp, type);
  }

  /**
   * Reset password
   */
  async resetPassword(email: string, otp: string, newPassword: string) {
    await this.otpService.verifyOtp(email, otp, OtpType.RESET);
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await this.prisma.user.update({
      where: { email: email.toLowerCase() },
      data: { password: hashedPassword },
    });

    return { message: 'Password reset successful' };
  }

  /**
   * Generate JWT tokens
   */
  private async generateTokens(
    user: Pick<
      AuthUserRecord,
      'id' | 'email' | 'role' | 'staffPermissions' | 'staffSessionVersion'
    >,
  ) {
    const payload = {
      sub: user.id,
      id: user.id,
      userId: user.id,
      email: user.email,
      role: user.role,
      permissions: user.staffPermissions,
      sessionVersion: user.staffSessionVersion,
    };

    const accessExpiry = this.configService.get<string>(
      'JWT_ACCESS_EXPIRY',
      '15m',
    );
    const refreshExpiry = this.configService.get<string>(
      'JWT_REFRESH_EXPIRY',
      '7d',
    );

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: accessExpiry as never,
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: refreshExpiry as never,
      }),
    ]);

    return { accessToken, refreshToken };
  }

  /**
   * Blacklist token
   */
  private async blacklistToken(token: string, ttl?: number) {
    const client = await this.redisService.getClient();
    if (client) {
      await client.set(
        this.getBlacklistKey(token),
        'blacklisted',
        'EX',
        ttl || this.TOKEN_BLACKLIST_TTL,
      );
    }
  }

  private getBlacklistKey(token: string): string {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    return `${this.TOKEN_BLACKLIST_PREFIX}${tokenHash}`;
  }

  /**
   * OAuth login
   */
  async oauthLogin(oauthLoginDto: OAuthLoginDto) {
    const { provider, idToken } = oauthLoginDto;
    if (provider !== OAuthProvider.GOOGLE) {
      this.logger.warn('authentication_oauth_rejected', {
        provider,
        reason: 'PROVIDER_NOT_ALLOWED',
      });
      throw new BadRequestException('Invalid OAuth provider');
    }

    const payload =
      await this.oauthVerificationService.verifyGoogleIdToken(idToken);
    const email = payload.email;
    const name = payload.name;
    const profileImage = payload.picture;
    const providerId = payload.sub;
    const prismaProvider = PrismaOAuthProvider.google;

    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.prisma.$transaction(async (transaction) => {
      const linkedAccount = await transaction.oAuthAccount.findUnique({
        where: {
          authProvider_providerId: {
            authProvider: prismaProvider,
            providerId,
          },
        },
        select: { id: true, user: { select: authUserSelect } },
      });
      if (linkedAccount) {
        if (linkedAccount.user.isDeleted) {
          this.logOAuthAccountRejection('ACCOUNT_DELETED', linkedAccount.user);
          throw new UnauthorizedException('Account has been deleted');
        }
        if (linkedAccount.user.role !== UserRole.user) {
          this.logOAuthAccountRejection('ROLE_NOT_ALLOWED', linkedAccount.user);
          throw new UnauthorizedException(
            'Customer sign-in is not available for staff accounts',
          );
        }
        await transaction.oAuthAccount.update({
          where: { id: linkedAccount.id },
          data: {
            email: normalizedEmail,
            isVerified: true,
            isDeleted: false,
            lastUsedAt: new Date(),
          },
        });
        return linkedAccount.user;
      }

      const emailUser = await transaction.user.findUnique({
        where: { email: normalizedEmail },
        select: authUserSelect,
      });
      if (emailUser?.isDeleted) {
        this.logOAuthAccountRejection('ACCOUNT_DELETED', emailUser);
        throw new UnauthorizedException('Account has been deleted');
      }
      if (emailUser && emailUser.role !== UserRole.user) {
        this.logOAuthAccountRejection('ROLE_NOT_ALLOWED', emailUser);
        throw new UnauthorizedException(
          'Customer sign-in is not available for staff accounts',
        );
      }
      const accountUser = emailUser
        ? await transaction.user.update({
            where: { id: emailUser.id },
            data: {
              isEmailVerified: true,
              profileImageUrl: profileImage || emailUser.profileImageUrl,
            },
            select: authUserSelect,
          })
        : await transaction.user.create({
            data: {
              name: name || normalizedEmail.split('@')[0],
              email: normalizedEmail,
              role: UserRole.user,
              isEmailVerified: true,
              authProvider: provider as UserAuthProvider,
              profileImageUrl: profileImage,
            },
            select: authUserSelect,
          });

      const linked = await transaction.oAuthAccount.upsert({
        where: {
          authProvider_providerId: {
            authProvider: prismaProvider,
            providerId,
          },
        },
        create: {
          userId: accountUser.id,
          authProvider: prismaProvider,
          providerId,
          email: normalizedEmail,
          isVerified: true,
          lastUsedAt: new Date(),
        },
        update: {
          email: normalizedEmail,
          isVerified: true,
          isDeleted: false,
          lastUsedAt: new Date(),
        },
        select: { user: { select: authUserSelect } },
      });
      if (linked.user.isDeleted) {
        this.logOAuthAccountRejection('ACCOUNT_DELETED', linked.user);
        throw new UnauthorizedException('Account has been deleted');
      }
      return linked.user;
    });

    const tokens = await this.generateTokens(user);

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        profileImageUrl: user.profileImageUrl,
      },
      ...tokens,
    };
  }

  private logOAuthAccountRejection(
    reason: 'ACCOUNT_DELETED' | 'ROLE_NOT_ALLOWED',
    user: Pick<AuthUserRecord, 'id' | 'role'>,
  ): void {
    this.logger.warn('authentication_oauth_rejected', {
      provider: 'GOOGLE',
      reason,
      userId: user.id,
      role: user.role,
    });
  }
}
