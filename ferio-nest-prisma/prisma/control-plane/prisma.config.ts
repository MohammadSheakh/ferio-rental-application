// Prisma config for the CONTROL PLANE database.
//
// Prisma 7 removed datasource URLs from schema files. Each plane gets
// its own config so CLI commands (db push / migrate deploy / studio)
// always target the correct database:
//
//   npx prisma db push --config prisma/control-plane/prisma.config.ts
//
import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: `${__dirname}/schema.prisma`,
  migrations: {
    path: `${__dirname}/migrations`,
  },
  datasource: {
    url: env('CONTROL_PLANE_DATABASE_URL'),
  },
});
