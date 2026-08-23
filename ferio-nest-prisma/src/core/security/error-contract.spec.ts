import { BadRequestException, HttpStatus } from '@nestjs/common';
import { HttpExceptionFilter, resolveErrorCode } from '@app/common';

describe('machine-readable error contract', () => {
  it('maps standard statuses and preserves safe domain codes', () => {
    expect(resolveErrorCode(HttpStatus.UNAUTHORIZED)).toBe(
      'AUTHENTICATION_REQUIRED',
    );
    expect(resolveErrorCode(HttpStatus.BAD_REQUEST, undefined, true)).toBe(
      'VALIDATION_ERROR',
    );
    expect(resolveErrorCode(HttpStatus.CONFLICT, 'ORDER_STATE_CONFLICT')).toBe(
      'ORDER_STATE_CONFLICT',
    );
    expect(resolveErrorCode(HttpStatus.BAD_REQUEST, 'unsafe-code')).toBe(
      'BAD_REQUEST',
    );
  });

  it('returns a stable code and correlation reference for validation errors', () => {
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    const host = {
      switchToHttp: () => ({
        getResponse: () => ({ status }),
        getRequest: () => ({
          method: 'POST',
          url: '/api/v1/orders?token=private',
          user: { userId: 'user-1' },
        }),
      }),
    };

    new HttpExceptionFilter().catch(
      new BadRequestException(['name must not be empty']),
      host as never,
    );

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        code: 'VALIDATION_ERROR',
        correlationId: expect.any(String),
        path: '/api/v1/orders?token=%5BREDACTED%5D',
      }),
    );
  });
});
