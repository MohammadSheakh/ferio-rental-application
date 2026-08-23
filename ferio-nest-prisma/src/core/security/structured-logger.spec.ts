import {
  buildStructuredLogEntry,
  runWithCorrelationId,
  sanitizeStructuredMetadata,
} from '@app/common';

describe('structured logger', () => {
  it('adds correlation context and preserves operational metadata', () => {
    runWithCorrelationId('structured-log-123', () => {
      const entry = buildStructuredLogEntry(
        'log',
        'PaymentRecoveryQueue',
        'payment_recovery_scheduler_registered',
        {
          schedulerId: 'ferio-payment-expiry-recovery',
          everyMinutes: 5,
          errorCode: 'PAYMENT_ATTEMPT_EXPIRED',
        },
      );

      expect(entry).toEqual(
        expect.objectContaining({
          level: 'log',
          context: 'PaymentRecoveryQueue',
          event: 'payment_recovery_scheduler_registered',
          correlationId: 'structured-log-123',
          metadata: {
            schedulerId: 'ferio-payment-expiry-recovery',
            everyMinutes: 5,
            errorCode: 'PAYMENT_ATTEMPT_EXPIRED',
          },
        }),
      );
      expect(entry.timestamp).toEqual(expect.any(String));
    });
  });

  it('redacts nested credentials and secret-looking values', () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    expect(
      sanitizeStructuredMetadata({
        authorization: 'Bearer private-token',
        provider: {
          clientSecret: 'private-secret',
          apiToken: 'private-token',
          apiKey: 'private-api-key',
          statusCode: 200,
        },
        detail: 'password=private-password',
        circular,
      }),
    ).toEqual({
      authorization: '[REDACTED]',
      provider: {
        clientSecret: '[REDACTED]',
        apiToken: '[REDACTED]',
        apiKey: '[REDACTED]',
        statusCode: 200,
      },
      detail: 'password=[REDACTED]',
      circular: { self: '[CIRCULAR]' },
    });
  });

  it('normalizes errors without exposing credentials', () => {
    runWithCorrelationId('structured-error-123', () => {
      const entry = buildStructuredLogEntry(
        'error',
        'CourierRouterService',
        'courier_provider_failed',
        { provider: 'PATHAO' },
        new Error('token=private-token provider request failed'),
      );

      expect(entry.error).toEqual(
        expect.objectContaining({
          name: 'Error',
          message: 'token=[REDACTED] provider request failed',
        }),
      );
      expect(JSON.stringify(entry)).not.toContain('private-token');
    });
  });
});
