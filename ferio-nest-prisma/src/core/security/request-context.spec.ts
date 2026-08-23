import {
  correlationHeaders,
  createCorrelationId,
  getCorrelationId,
  runWithCorrelationId,
} from '@app/common';

describe('request correlation context', () => {
  it('accepts safe incoming IDs and replaces malformed values', () => {
    expect(createCorrelationId('web-request_123')).toBe('web-request_123');
    expect(createCorrelationId('unsafe value\nheader')).not.toContain('\n');
  });

  it('keeps one ID throughout an asynchronous request flow', async () => {
    await runWithCorrelationId('request-flow-123', async () => {
      await Promise.resolve();
      expect(getCorrelationId()).toBe('request-flow-123');
      expect(correlationHeaders({ Accept: 'application/json' })).toEqual({
        Accept: 'application/json',
        'X-Correlation-ID': 'request-flow-123',
      });
    });
  });
});
