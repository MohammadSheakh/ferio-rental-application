const REDACTED = '[REDACTED]';
const SENSITIVE_QUERY_KEY =
  /(?:authorization|credential|password|secret|signature|token|code|session_id|val_id)/i;
const SENSITIVE_VALUE =
  /((?:authorization|credential|password|secret|signature|token|client[_-]?secret)\s*[=:]\s*)([^\s,;&]+)/gi;

export function sanitizeUrlForLogs(rawUrl: string): string {
  try {
    const url = new URL(rawUrl, 'http://ferio.local');
    for (const key of url.searchParams.keys()) {
      if (SENSITIVE_QUERY_KEY.test(key)) {
        url.searchParams.set(key, REDACTED);
      }
    }
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return rawUrl.split('?')[0];
  }
}

export function sanitizeLogText(value: unknown): string {
  const text = value instanceof Error ? value.message : String(value ?? '');
  return text
    .replace(/Bearer\s+[^\s,;]+/gi, `Bearer ${REDACTED}`)
    .replace(SENSITIVE_VALUE, `$1${REDACTED}`);
}
