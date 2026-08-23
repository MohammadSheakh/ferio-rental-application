import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

/**
 * Prisma config for the LEGACY single-database application
 * (prisma/schema.prisma + prisma/migrations).
 *
 * NOTE: The three-plane schemas (control-plane / marketplace / tenant)
 * have their own configs and must be addressed with --config:
 *
 *   npx prisma db push --config prisma/control-plane/prisma.config.ts
 *   npx prisma db push --config prisma/marketplace/prisma.config.ts
 *   TENANT_DATABASE_URL=… npx prisma migrate deploy --config prisma/tenant/prisma.config.ts
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
