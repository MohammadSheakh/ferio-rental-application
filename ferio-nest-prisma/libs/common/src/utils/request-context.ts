import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

type RequestContext = {
  correlationId: string;
};

const requestContext = new AsyncLocalStorage<RequestContext>();
const VALID_CORRELATION_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;

export function createCorrelationId(value?: string | string[]): string {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate && VALID_CORRELATION_ID.test(candidate)
    ? candidate
    : randomUUID();
}

export function runWithCorrelationId<T>(
  correlationId: string,
  callback: () => T,
): T {
  return requestContext.run({ correlationId }, callback);
}

export function getCorrelationId(): string {
  const existing = requestContext.getStore()?.correlationId;
  if (existing) return existing;

  const correlationId = randomUUID();
  requestContext.enterWith({ correlationId });
  return correlationId;
}

export function correlationHeaders(
  headers: Record<string, string> = {},
): Record<string, string> {
  return {
    ...headers,
    'X-Correlation-ID': getCorrelationId(),
  };
}
