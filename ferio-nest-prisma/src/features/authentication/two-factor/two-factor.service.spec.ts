import { TwoFactorService } from './two-factor.service';

describe('TwoFactorService', () => {
  function setup() {
    const prisma = {
      user: { findUnique: jest.fn(), update: jest.fn() },
    };
    const config = {
      get: jest.fn((key: string, fallback?: string) =>
        key === 'TWO_FACTOR_ENCRYPTION_KEY'
          ? 'test-encryption-key-with-32-characters-minimum'
          : fallback,
      ),
    };
    return {
      service: new TwoFactorService(prisma as never, config as never),
      prisma,
    };
  }

  it('stores an encrypted pending secret and returns an authenticator URI', async () => {
    const { service, prisma } = setup();
    prisma.user.update.mockResolvedValue({});

    const result = await service.beginEnrollment(
      'admin-1',
      'admin@example.com',
    );
    const encrypted = prisma.user.update.mock.calls[0][0].data
      .twoFactorPendingEncrypted as string;

    expect(result.secret).toMatch(/^[A-Z2-7]{32}$/);
    expect(result.uri).toContain('otpauth://totp/');
    expect(result.uri).toContain(`secret=${result.secret}`);
    expect(encrypted).not.toContain(result.secret);
    expect(encrypted.split('.')).toHaveLength(3);
  });

  it('accepts a valid TOTP and stores only hashed recovery codes', async () => {
    const { service, prisma } = setup();
    prisma.user.update.mockResolvedValue({});
    const enrollment = await service.beginEnrollment(
      'admin-1',
      'admin@example.com',
    );
    const encrypted = prisma.user.update.mock.calls[0][0].data
      .twoFactorPendingEncrypted as string;
    prisma.user.findUnique.mockResolvedValue({
      twoFactorPendingEncrypted: encrypted,
    });
    const internals = service as unknown as {
      totp(secret: string, counter: number): string;
    };
    const code = internals.totp(
      enrollment.secret,
      Math.floor(Date.now() / 30_000),
    );

    const result = await service.confirmEnrollment('admin-1', code);
    const stored = prisma.user.update.mock.calls[1][0].data;

    expect(result.recoveryCodes).toHaveLength(8);
    expect(stored.twoFactorEnabled).toBe(true);
    expect(stored.twoFactorRecoveryCodeHashes).toHaveLength(8);
    expect(stored.twoFactorRecoveryCodeHashes[0]).not.toBe(
      result.recoveryCodes[0],
    );
    expect(stored.staffSessionVersion).toEqual({ increment: 1 });
  });
});
