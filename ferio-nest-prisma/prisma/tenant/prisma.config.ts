// Prisma config for the TENANT database template.
//
// Prisma 7 removed datasource URLs from schema files. Each plane gets
// its own config so CLI commands always target the correct database.
//
// The TENANT_DATABASE_URL is injected per-tenant by the provisioning
// service and migration orchestrator:
//
//   TENANT_DATABASE_URL=postgresql://…/tenant_rahman \
//     npx prisma migrate deploy --config prisma/tenant/prisma.config.ts
//
import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: `${__dirname}/schema.prisma`,
  migrations: {
    path: `${__dirname}/migrations`,
  },
  datasource: {
    url: env('TENANT_DATABASE_URL'),
  },
});
