const MAX_DURATION_SAMPLES = 1000;

type RequestMetricInput = {
  durationMs: number;
  statusCode: number;
};

export type RequestMetricsSnapshot = {
  observedSince: string;
  total: number;
  successful: number;
  clientErrors: number;
  serverErrors: number;
  averageDurationMs: number;
  p95DurationMs: number;
  maxDurationMs: number;
  sampleSize: number;
};

export class RequestMetrics {
  private static observedSince = new Date();
  private static total = 0;
  private static successful = 0;
  private static clientErrors = 0;
  private static serverErrors = 0;
  private static totalDurationMs = 0;
  private static maxDurationMs = 0;
  private static durations: number[] = [];

  static record(input: RequestMetricInput) {
    const durationMs = Math.max(0, Math.round(input.durationMs));
    this.total += 1;
    this.totalDurationMs += durationMs;
    this.maxDurationMs = Math.max(this.maxDurationMs, durationMs);
    if (input.statusCode >= 500) this.serverErrors += 1;
    else if (input.statusCode >= 400) this.clientErrors += 1;
    else this.successful += 1;
    this.durations.push(durationMs);
    if (this.durations.length > MAX_DURATION_SAMPLES) this.durations.shift();
  }

  static snapshot(): RequestMetricsSnapshot {
    const sorted = [...this.durations].sort((left, right) => left - right);
    const p95Index = Math.max(0, Math.ceil(sorted.length * 0.95) - 1);
    return {
      observedSince: this.observedSince.toISOString(),
      total: this.total,
      successful: this.successful,
      clientErrors: this.clientErrors,
      serverErrors: this.serverErrors,
      averageDurationMs:
        this.total === 0 ? 0 : Math.round(this.totalDurationMs / this.total),
      p95DurationMs: sorted[p95Index] ?? 0,
      maxDurationMs: this.maxDurationMs,
      sampleSize: sorted.length,
    };
  }

  static resetForTests() {
    this.observedSince = new Date();
    this.total = 0;
    this.successful = 0;
    this.clientErrors = 0;
    this.serverErrors = 0;
    this.totalDurationMs = 0;
    this.maxDurationMs = 0;
    this.durations = [];
  }
}
