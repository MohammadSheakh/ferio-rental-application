jest.mock('../otp/otp.service', () => ({ OtpService: class OtpService {} }));
jest.mock('../email/email.service', () => ({
  EmailService: class EmailService {},
}));
jest.mock('../oauth/oauth-verification.service', () => ({
  OAuthVerificationService: class OAuthVerificationService {},
}));
jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';

describe('AuthService token lifecycle', () => {
  const signAsync = jest.fn().mockResolvedValue('signed-token');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  function createService(options?: {
    findFirst?: jest.Mock;
    findUnique?: jest.Mock;
    update?: jest.Mock;
    redisClient?: { get: jest.Mock; set?: jest.Mock } | null;
    verifyAsync?: jest.Mock;
  }) {
    const prisma = {
      user: {
        findFirst: options?.findFirst ?? jest.fn(),
        findUnique: options?.findUnique ?? jest.fn(),
        update: options?.update ?? jest.fn(),
      },
    };
    const jwtService = {
      signAsync,
      verifyAsync: options?.verifyAsync ?? jest.fn(),
    };
    const redisService = {
      getClient: jest.fn().mockResolvedValue(options?.redisClient ?? null),
    };
    const configService = {
      get: jest.fn((_key: string, fallback: string) => fallback),
      getOrThrow: jest.fn((key: string) => key),
    };
    const service = new AuthService(
      prisma as never,
      jwtService as never,
      {} as never,
      {} as never,
      {} as never,
      redisService as never,
      configService as never,
    );
    const logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
    (service as unknown as { logger: typeof logger }).logger = logger;
    return { service, prisma, logger };
  }

  it('uses short access tokens and seven-day refresh tokens by default', async () => {
    const configService = {
      get: jest.fn((_key: string, fallback: string) => fallback),
      getOrThrow: jest.fn((key: string) => key),
    };
    const service = new AuthService(
      {} as never,
      { signAsync } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      configService as never,
    );

    await (
      service as unknown as {
        generateTokens(user: {
          id: string;
          email: string;
          role: string;
        }): Promise<unknown>;
      }
    ).generateTokens({
      id: 'user-1',
      email: 'user@example.com',
      role: 'customer',
    });

    expect(signAsync).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ sub: 'user-1' }),
      expect.objectContaining({ expiresIn: '15m' }),
    );
    expect(signAsync).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ sub: 'user-1' }),
      expect.objectContaining({ expiresIn: '7d' }),
    );
  });

  it('logs an identifier-free event for an unknown password account', async () => {
    const { service, logger } = createService({
      findFirst: jest.fn().mockResolvedValue(null),
    });

    await expect(
      service.login({
        email: 'private-customer@example.com',
        password: 'private-password',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(logger.warn).toHaveBeenCalledWith('authentication_login_rejected', {
      method: 'PASSWORD',
      audience: 'CUSTOMER',
      reason: 'INVALID_CREDENTIALS',
      accountMatched: false,
      userId: undefined,
    });
    expect(JSON.stringify(logger.warn.mock.calls)).not.toContain(
      'private-customer@example.com',
    );
    expect(JSON.stringify(logger.warn.mock.calls)).not.toContain(
      'private-password',
    );
  });

  it('logs when the final failed password attempt applies lockout', async () => {
    const user = {
      id: 'user-locked',
      name: 'Customer',
      email: 'customer@example.com',
      password: 'password-hash',
      role: 'user',
      profileImageUrl: null,
      failedLoginAttempts: 4,
      lockUntil: null,
      isDeleted: false,
      isEmailVerified: true,
      authProvider: 'local',
      customerId: 'customer-1',
    };
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);
    const update = jest.fn().mockResolvedValue(user);
    const { service, logger } = createService({
      findFirst: jest.fn().mockResolvedValue(user),
      update,
    });

    await expect(
      service.login({ email: user.email, password: 'wrong-password' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: user.id },
        data: expect.objectContaining({
          failedLoginAttempts: 0,
          lockUntil: expect.any(Date),
        }),
      }),
    );
    expect(logger.warn).toHaveBeenCalledWith(
      'authentication_login_rejected',
      expect.objectContaining({
        reason: 'INVALID_CREDENTIALS',
        userId: user.id,
        failedAttemptCount: 5,
        lockApplied: true,
        lockUntil: expect.any(Date),
      }),
    );
    expect(JSON.stringify(logger.warn.mock.calls)).not.toContain(
      'wrong-password',
    );
  });

  it('logs rejected reuse of a revoked refresh token', async () => {
    const { service, logger } = createService({
      redisClient: { get: jest.fn().mockResolvedValue('blacklisted') },
    });

    await expect(
      service.refreshToken('private-refresh-token'),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(logger.warn).toHaveBeenCalledWith(
      'authentication_refresh_rejected',
      { reason: 'TOKEN_REVOKED' },
    );
    expect(JSON.stringify(logger.warn.mock.calls)).not.toContain(
      'private-refresh-token',
    );
  });
});
