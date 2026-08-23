import {
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';
import { OAuthVerificationService } from './oauth-verification.service';

describe('OAuthVerificationService', () => {
  afterEach(() => jest.restoreAllMocks());

  it('rejects Google sign-in when no client ID is configured', async () => {
    const service = new OAuthVerificationService({
      get: jest.fn().mockReturnValue(undefined),
    } as unknown as ConfigService);

    await expect(service.verifyGoogleIdToken('token')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('returns only a verified Google identity for the configured audience', async () => {
    const verifyIdToken = jest
      .spyOn(OAuth2Client.prototype, 'verifyIdToken')
      .mockResolvedValue({
        getPayload: () => ({
          sub: 'google-user-1',
          email: ' CUSTOMER@EXAMPLE.COM ',
          email_verified: true,
          name: 'Ferio Customer',
          picture: 'https://example.com/customer.jpg',
        }),
      } as never);
    const service = new OAuthVerificationService({
      get: jest.fn().mockReturnValue('google-client-id'),
    } as unknown as ConfigService);

    await expect(service.verifyGoogleIdToken('valid-token')).resolves.toEqual({
      sub: 'google-user-1',
      email: 'customer@example.com',
      email_verified: true,
      name: 'Ferio Customer',
      picture: 'https://example.com/customer.jpg',
    });
    expect(verifyIdToken).toHaveBeenCalledWith({
      idToken: 'valid-token',
      audience: 'google-client-id',
    });
  });

  it('rejects an unverified Google email', async () => {
    jest.spyOn(OAuth2Client.prototype, 'verifyIdToken').mockResolvedValue({
      getPayload: () => ({
        sub: 'google-user-2',
        email: 'customer@example.com',
        email_verified: false,
      }),
    } as never);
    const service = new OAuthVerificationService({
      get: jest.fn().mockReturnValue('google-client-id'),
    } as unknown as ConfigService);
    const logger = { warn: jest.fn() };
    (service as unknown as { logger: typeof logger }).logger = logger;

    await expect(
      service.verifyGoogleIdToken('unverified-token'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(logger.warn).toHaveBeenCalledWith('authentication_oauth_rejected', {
      provider: 'GOOGLE',
      reason: 'IDENTITY_UNVERIFIED',
    });
    expect(JSON.stringify(logger.warn.mock.calls)).not.toContain(
      'unverified-token',
    );
  });
});
