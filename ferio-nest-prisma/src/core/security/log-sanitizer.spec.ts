import { sanitizeLogText, sanitizeUrlForLogs } from '@app/common';

describe('secret-safe diagnostics', () => {
  it('redacts sensitive query parameters while preserving route context', () => {
    expect(
      sanitizeUrlForLogs(
        '/api/v1/payment/callback?tran_id=order-1&token=private-token&code=oauth-code',
      ),
    ).toBe(
      '/api/v1/payment/callback?tran_id=order-1&token=%5BREDACTED%5D&code=%5BREDACTED%5D',
    );
  });

  it('redacts bearer credentials and labelled secrets from errors', () => {
    const sanitized = sanitizeLogText(
      'Authorization=Bearer private-token client_secret=private-secret',
    );

    expect(sanitized).not.toContain('private-token');
    expect(sanitized).not.toContain('private-secret');
    expect(sanitized).toContain('[REDACTED]');
  });
});
