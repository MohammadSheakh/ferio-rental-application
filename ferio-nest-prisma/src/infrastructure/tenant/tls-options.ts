/**
 * Map a PostgreSQL URL's `sslmode` onto node-postgres TLS config.
 *
 * pg treats any sslmode except `disable` as "use TLS" and cannot do
 * opportunistic negotiation, so `prefer` crashes against servers
 * without TLS. Explicit mapping:
 *   require     → TLS (no client-side CA verification)
 *   verify-ca   → TLS
 *   verify-full → TLS (pg verifies chain; hostname via pg options)
 *   disable / prefer / allow / absent → no TLS (local/dev default)
 */
export function tlsOptionsFromUrl(databaseUrl: string): {
  connectionString: string;
  ssl?: boolean;
} {
  const url = new URL(databaseUrl);
  const sslMode = url.searchParams.get('sslmode');
  url.searchParams.delete('sslmode');

  let ssl: boolean | undefined;
  switch (sslMode) {
    case 'require':
    case 'verify-ca':
    case 'verify-full':
      ssl = true;
      break;
    default:
      ssl = undefined;
  }

  return {
    connectionString: url.toString(),
    ...(ssl !== undefined ? { ssl } : {}),
  };
}
