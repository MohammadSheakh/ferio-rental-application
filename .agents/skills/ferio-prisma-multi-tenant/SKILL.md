---
name: ferio-prisma-multi-tenant
description: Ferio Prisma 7 multi-tenant setup — per-plane configs, driver adapters, migration rules. Apply when touching Prisma schemas, writing migrations, or debugging DB connections.
---

# Ferio Prisma Multi-Tenant Setup

## Architecture: Four Prisma Projects

| Plane | Schema | Config | Client |
|---|---|---|---|
| Legacy | `prisma/schema.prisma` | `prisma.config.ts` (root) | `.prisma/client` |
| Control | `prisma/control-plane/` | `control-plane/prisma.config.ts` | `@prisma/control-client` |
| Marketplace | `prisma/marketplace/` | `marketplace/prisma.config.ts` | `@prisma/marketplace-client` |
| Tenant | `prisma/tenant/` | `tenant/prisma.config.ts` | `@prisma/tenant-client` |

## Non-Negotiable Rules

1. NO url in schema files (Prisma 7 removed it)
2. NO datasourceUrl in client constructors — use driver adapters (PrismaPg)
3. Always pass --config for non-default plane CLI commands
4. Never edit an applied migration — create a new migration file
5. Use migrate deploy, never db push, for tenant provisioning
6. Prisma 7 AI-consent guard: set PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION

## Runtime Client Pattern (Prisma 7)

```typescript
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
const pool = new Pool({ connectionString: process.env.X_DATABASE_URL });
const client = new XPrismaClient({ adapter: new PrismaPg(pool) });
```

NO datasourceUrl — that was removed in Prisma 7.

## TLS Mapping

pg treats any sslmode except disable as "use TLS". Map explicitly:
- require/verify-ca/verify-full → ssl = true
- disable/prefer/allow/absent → ssl = undefined

See `src/infrastructure/tenant/tls-options.ts`.

## Migration Authoring

- Migrations live in `<plane>/migrations/<timestamp>_<name>/migration.sql`
- Never edit an applied migration — create a new one
- Hand-write reviewed SQL or generate via migrate diff with shadow DB
- Deploy with: `npx prisma migrate deploy --config prisma/tenant/prisma.config.ts`

## PostGIS DDL (marketplace plane)

Prisma cannot manage generated columns/GiST indexes. Versioned SQL files
live in `prisma/marketplace/sql/` and are applied by the SQL applier:

```bash
pnpm prisma:marketplace:sql
```
