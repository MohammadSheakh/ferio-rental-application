import { Prisma } from '@prisma/client';

const sensitiveKey = /(password|secret|token|authorization|cookie|credential|signature|api[-_]?key)/i;

function sanitize(value: unknown, depth: number): unknown {
  if (depth > 8) return '[TRUNCATED]';
  if (Array.isArray(value)) return value.map((item) => sanitize(item, depth + 1));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        sensitiveKey.test(key) ? '[REDACTED]' : sanitize(item, depth + 1),
      ]),
    );
  }
  if (typeof value === 'string' && value.length > 2000) {
    return `${value.slice(0, 2000)}…`;
  }
  return value;
}

export function safeAuditJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null) return undefined;
  return sanitize(value, 0) as Prisma.InputJsonValue;
}
