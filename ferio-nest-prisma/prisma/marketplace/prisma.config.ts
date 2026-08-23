// Prisma config for the MARKETPLACE database.
//
// Prisma 7 removed datasource URLs from schema files. Each plane gets
// its own config so CLI commands (db push / migrate deploy / studio)
// always target the correct database:
//
//   npx prisma db push --config prisma/marketplace/prisma.config.ts
//
// PostGIS DDL is managed separately via prisma:marketplace:sql.
//
import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: `${__dirname}/schema.prisma`,
  migrations: {
    path: `${__dirname}/migrations`,
  },
  datasource: {
    url: env('MARKETPLACE_DATABASE_URL'),
  },
});
