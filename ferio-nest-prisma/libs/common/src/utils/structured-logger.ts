import { Logger } from '@nestjs/common';
import { sanitizeLogText } from './log-sanitizer';
import { getCorrelationId } from './request-context';

const REDACTED = '[REDACTED]';
const MAX_DEPTH = 5;
const MAX_COLLECTION_SIZE = 50;
const SENSITIVE_FIELD =
  /(?:^|_)(?:authorization|cookie|credential|password|secret|signature|token|session|api_key|private_key|access_key)(?:_|$)/i;

export type StructuredLogMetadata = Record<string, unknown>;

export type StructuredLogEntry = {
  timestamp: string;
  level: 'log' | 'warn' | 'error';
  context: string;
  event: string;
  correlationId: string;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  metadata?: StructuredLogMetadata;
};

function normalizeFieldName(field: string): string {
  return field
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[-.\s]+/g, '_')
    .toLowerCase();
}

function sanitizeValue(
  value: unknown,
  seen: WeakSet<object>,
  depth: number,
  field?: string,
): unknown {
  if (field && SENSITIVE_FIELD.test(normalizeFieldName(field))) {
    return REDACTED;
  }
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return sanitizeLogText(value);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Error) {
    return {
      name: value.name,
      message: sanitizeLogText(value.message),
    };
  }
  if (typeof value !== 'object') return sanitizeLogText(value);
  if (depth >= MAX_DEPTH) return '[TRUNCATED]';
  if (seen.has(value)) return '[CIRCULAR]';

  seen.add(value);
  if (Array.isArray(value)) {
    return value
      .slice(0, MAX_COLLECTION_SIZE)
      .map((item) => sanitizeValue(item, seen, depth + 1));
  }

  return Object.fromEntries(
    Object.entries(value)
      .slice(0, MAX_COLLECTION_SIZE)
      .map(([key, item]) => [key, sanitizeValue(item, seen, depth + 1, key)]),
  );
}

export function sanitizeStructuredMetadata(
  metadata: StructuredLogMetadata,
): StructuredLogMetadata {
  return sanitizeValue(
    metadata,
    new WeakSet<object>(),
    0,
  ) as StructuredLogMetadata;
}

export function buildStructuredLogEntry(
  level: StructuredLogEntry['level'],
  context: string,
  event: string,
  metadata: StructuredLogMetadata = {},
  error?: unknown,
): StructuredLogEntry {
  const entry: StructuredLogEntry = {
    timestamp: new Date().toISOString(),
    level,
    context,
    event,
    correlationId: getCorrelationId(),
  };
  const sanitizedMetadata = sanitizeStructuredMetadata(metadata);
  if (Object.keys(sanitizedMetadata).length > 0) {
    entry.metadata = sanitizedMetadata;
  }
  if (error !== undefined) {
    const normalizedError =
      error instanceof Error ? error : new Error(sanitizeLogText(error));
    entry.error = {
      name: normalizedError.name,
      message: sanitizeLogText(normalizedError.message),
      ...(process.env.NODE_ENV === 'development' && normalizedError.stack
        ? { stack: sanitizeLogText(normalizedError.stack) }
        : {}),
    };
  }
  return entry;
}

export class StructuredLogger {
  private readonly logger: Logger;

  constructor(private readonly context: string) {
    this.logger = new Logger(context);
  }

  private isJsonMode(): boolean {
    return process.env.LOG_FORMAT === 'json';
  }

  private formatMessage(
    level: StructuredLogEntry['level'],
    event: string,
    metadata: StructuredLogMetadata = {},
    error?: unknown,
  ): string {
    if (this.isJsonMode()) {
      return JSON.stringify(
        buildStructuredLogEntry(level, this.context, event, metadata, error),
      );
    }

    const method = metadata.method ? String(metadata.method).toUpperCase() : '';
    const path = metadata.path ? String(metadata.path) : '';
    const statusCode = metadata.statusCode ? String(metadata.statusCode) : '';
    const duration =
      metadata.durationMs !== undefined ? `${metadata.durationMs}ms` : '';
    const userId = metadata.userId ? String(metadata.userId) : 'anonymous';
    const clientIp = metadata.clientIp ? String(metadata.clientIp) : '';

    if (method && path) {
      if (level === 'error') {
        const errorMsg =
          (error instanceof Error ? error.message : null) ||
          (typeof metadata.message === 'string' ? metadata.message : null) ||
          (typeof error === 'string' ? error : 'An unexpected error occurred');
        return `${method} ${path} ${statusCode || 500} - ${errorMsg} - User: ${userId}`;
      }

      const ipPart = clientIp ? ` - IP: ${clientIp}` : '';
      return `${method} ${path} ${statusCode || 200} - ${duration || '0ms'} - User: ${userId}${ipPart}`;
    }

    // Non-HTTP events
    const metaKeys = Object.keys(metadata);
    const metaStr =
      metaKeys.length > 0
        ? ` ${JSON.stringify(sanitizeStructuredMetadata(metadata))}`
        : '';
    const errStr = error
      ? ` -> ${error instanceof Error ? error.message : String(error)}`
      : '';

    return `${event}${metaStr}${errStr}`;
  }

  log(event: string, metadata: StructuredLogMetadata = {}): void {
    this.logger.log(this.formatMessage('log', event, metadata));
  }

  warn(event: string, metadata: StructuredLogMetadata = {}): void {
    this.logger.warn(this.formatMessage('warn', event, metadata));
  }

  error(
    event: string,
    error: unknown,
    metadata: StructuredLogMetadata = {},
  ): void {
    this.logger.error(this.formatMessage('error', event, metadata, error));
  }
}
