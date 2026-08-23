---
name: ferio-testing
description: How to run Ferio verification scripts against scratch PostgreSQL databases. Covers env vars, docker containers, consent guard, and known gotchas. Apply when running or writing verify scripts.
---

# Ferio Testing

## Scratch Environment

| Container | Image | Port | Databases |
|---|---|---|---|
| `ferio-pg-gis` | postgis/postgis:16-3.4 | 5498 | ferio_control, ferio_marketplace, tenant_sheakh_fam |
| `ferio-pg-test` | postgres:16 | 5499 | scratch_guard |

Start if stopped: `docker start ferio-pg-gis ferio-pg-test`

## Environment Variables (required by verify scripts)

```bash
CONTROL_PLANE_DATABASE_URL="postgresql://postgres:testpass@localhost:5498/ferio_control"
MARKETPLACE_DATABASE_URL="postgresql://postgres:testpass@localhost:5498/ferio_marketplace"
DATABASE_URL="postgresql://postgres:testpass@localhost:5498/ferio_marketplace"
TENANT_DATABASE_URL="postgresql://postgres:testpass@localhost:5498/tenant_sheakh_fam"

# For provisioning/migration orchestrator tests:
TENANT_DB_HOST=localhost
TENANT_DB_PORT=5498
TENANT_DB_USERNAME=postgres
TENANT_DB_PASSWORD=testpass
```

⚠️ **Never use port 6733 or 6734** — those are occupied by the user's other project (`e-com-nextjs`).

## Running Verify Scripts

```bash
cd ferio-nest-prisma
npx ts-node --transpile-only -r tsconfig-paths/register test/progXX.verify.ts
```

Scripts self-provision their own data. Check the `RESULT: N passed / M failed` line.

## Prisma Consent Guard

Prisma 7.9+ blocks `db push` / `migrate` when it detects an AI agent. Bypass with:

```bash
PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION="<exact user message consenting>" npx prisma db push --config prisma/control-plane/prisma.config.ts
```

The consent message must be the user's verbatim text authorizing the operation.

## Known Gotchas

1. **Shell cwd resets between tool calls** — always `cd` explicitly in each command
2. **Compound build+launch commands race** — build in one call, launch in another
3. **`setsid --fork`** required for background server processes (plain `&` gets killed)
4. **Port 6799** for test API instances (never 3000/3001/6733)
5. **Editing applied migrations doesn't re-run them** — create a new migration file instead
6. **`db push` vs `migrate deploy` drift** — db push doesn't record in `_prisma_migrations`; use migrate deploy for versioned schemas
