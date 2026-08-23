import { HttpException } from '@nestjs/common';
import { SlidingWindowRateLimitGuard } from '@app/common';

describe('rate-limit security events', () => {
  it('logs a bounded authentication rejection without client identifiers', async () => {
    const pipeline = {
      zremrangebyscore: jest.fn(),
      zadd: jest.fn(),
      expire: jest.fn(),
      zcard: jest.fn(),
      zrange: jest.fn(),
      exec: jest.fn(),
    };
    for (const method of [
      'zremrangebyscore',
      'zadd',
      'expire',
      'zcard',
      'zrange',
    ] as const) {
      pipeline[method].mockReturnValue(pipeline);
    }
    pipeline.exec.mockResolvedValue([
      [null, 0],
      [null, 1],
      [null, 1],
      [null, 6],
      [null, ['request-id', String(Date.now() - 1_000)]],
    ]);

    const reflector = {
      get: jest.fn().mockReturnValue({
        max: 5,
        windowMs: 15 * 60 * 1_000,
        keyPrefix: 'auth',
      }),
    };
    const guard = new SlidingWindowRateLimitGuard(
      reflector as never,
      { multi: jest.fn().mockReturnValue(pipeline) } as never,
    );
    const logger = { warn: jest.fn(), error: jest.fn() };
    (guard as unknown as { logger: typeof logger }).logger = logger;
    const response = { set: jest.fn() };
    const context = {
      getHandler: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({ ip: 'private-client-address' }),
        getResponse: () => response,
      }),
    };

    await expect(guard.canActivate(context as never)).rejects.toBeInstanceOf(
      HttpException,
    );

    expect(logger.warn).toHaveBeenCalledWith(
      'authentication_rate_limit_exceeded',
      expect.objectContaining({
        keyPrefix: 'auth',
        requestCount: 6,
        requestLimit: 5,
        windowMs: 15 * 60 * 1_000,
        retryAfterSeconds: expect.any(Number),
      }),
    );
    expect(JSON.stringify(logger.warn.mock.calls)).not.toContain(
      'private-client-address',
    );
  });
});
