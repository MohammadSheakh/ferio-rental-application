/**
 * § P0 hardening — per-tenant credential resolution.
 *
 * `TenantDatabase.passwordRef` (and any future credential reference)
 * supports two forms:
 *   env:VAR_NAME   → read the password from process.env[VAR_NAME]
 *   kms:keyId      → reserved for a future secret-manager driver
 *
 * Resolution order for every tenant connection built in the platform:
 *   1. passwordRef on the DB row (env:/kms:)
 *   2. TENANT_DB_PASSWORD / TENANT_DB_DEFAULT_PASSWORD (shared fallback)
 *
 * This lets operators rotate one org's credential without touching the
 * rest of the fleet, and keeps the shared-password fallback honest.
 */
export function resolveTenantPassword(passwordRef?: string | null): string {
  if (passwordRef?.startsWith('env:')) {
    const varName = passwordRef.slice(4);
    const value = process.env[varName];
    if (!value) {
      throw new Error(`Credential ref "${passwordRef}" points at unset env var ${varName}`);
    }
    return value;
  }
  return (
    process.env.TENANT_DB_PASSWORD ||
    process.env.TENANT_DB_DEFAULT_PASSWORD ||
    'postgres'
  );
}

export function buildTenantUrl(
  db: { host: string; port: number; username: string; databaseName: string; sslMode: string; passwordRef?: string | null },
): string {
  const password = resolveTenantPassword((db as any).passwordRef);
  return `postgresql://${db.username}:${encodeURIComponent(password)}@${db.host}:${db.port}/${db.databaseName}?sslmode=${db.sslMode}`;
}
