import type { Request, Response } from 'express';
import { UnauthorizedException } from '@nestjs/common';

jest.mock('./auth.service', () => ({ AuthService: class AuthService {} }));

import { AuthController } from './auth.controller';

describe('AuthController native session contract', () => {
  const authService = {
    refreshToken: jest.fn(),
    logout: jest.fn(),
  };
  const response = {
    cookie: jest.fn(),
    clearCookie: jest.fn(),
  } as unknown as Response;
  let controller: AuthController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new AuthController(authService as never);
  });

  it('rotates a refresh token supplied by a native client body', async () => {
    authService.refreshToken.mockResolvedValue({
      accessToken: 'next-access-token',
      refreshToken: 'next-refresh-token',
    });

    await expect(
      controller.refresh(
        { headers: {} } as Request,
        { refreshToken: 'native-refresh-token-value' },
        response,
      ),
    ).resolves.toEqual({
      accessToken: 'next-access-token',
      refreshToken: 'next-refresh-token',
    });
    expect(authService.refreshToken).toHaveBeenCalledWith(
      'native-refresh-token-value',
    );
  });

  it('revokes a refresh token supplied by a native client body', async () => {
    authService.logout.mockResolvedValue({ message: 'Logout successful' });

    await controller.logout(
      { headers: {} } as Request,
      { refreshToken: 'native-refresh-token-value' },
      response,
    );

    expect(authService.logout).toHaveBeenCalledWith(
      'native-refresh-token-value',
    );
    expect(response.clearCookie).toHaveBeenCalled();
  });

  it('logs refresh rejection without exposing request credentials', async () => {
    const logger = { warn: jest.fn() };
    (controller as unknown as { logger: typeof logger }).logger = logger;

    await expect(
      controller.refresh({ headers: {} } as Request, {}, response),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(logger.warn).toHaveBeenCalledWith(
      'authentication_refresh_rejected',
      { reason: 'TOKEN_MISSING' },
    );
  });
});
