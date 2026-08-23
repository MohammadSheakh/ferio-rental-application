import { RequestMetrics } from '@app/common';

describe('RequestMetrics', () => {
  beforeEach(() => RequestMetrics.resetForTests());

  it('aggregates request outcomes and bounded latency evidence', () => {
    RequestMetrics.record({ statusCode: 200, durationMs: 10 });
    RequestMetrics.record({ statusCode: 404, durationMs: 20 });
    RequestMetrics.record({ statusCode: 503, durationMs: 100 });

    expect(RequestMetrics.snapshot()).toEqual(
      expect.objectContaining({
        total: 3,
        successful: 1,
        clientErrors: 1,
        serverErrors: 1,
        averageDurationMs: 43,
        p95DurationMs: 100,
        maxDurationMs: 100,
        sampleSize: 3,
      }),
    );
  });
});
