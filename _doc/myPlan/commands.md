# Ferio Property Platform — Commands Reference

**Working directory:** `/home/chillpc/MohammadSheakh/projects/26/ferio-rental` unless noted.

---

## 1. Prerequisites

### Docker containers (scratch databases)

```bash
# PostGIS (control-plane + marketplace + tenant DBs)
docker run -d --name ferio-pg-gis \
  -e POSTGRES_PASSWORD=testpass -p 5498:5432 \
  postgis/postgis:16-3.4

# Plain PostgreSQL (legacy / extra scratch)
docker run -d --name ferio-pg-test \
  -e POSTGRES_PASSWORD=testpass -p 5499:5432 \
  postgres:16

# Verify both are accepting connections
docker exec ferio-pg-gis pg_isready -U postgres
```

### Create databases inside the container

```bash
docker exec ferio-pg-gis psql -U postgres -c "CREATE DATABASE ferio_control;"
docker exec ferio-pg-gis psql -U postgres -c "CREATE DATABASE ferio_marketplace;"
```

### Install dependencies (pnpm workspace)

```bash
pnpm install
```

---

## 2. Environment Variables

Create `ferio-nest-prisma/.env` (see `.env.example` for template). Key variables:

```env
# Control Plane
CONTROL_PLANE_DATABASE_URL=postgresql://postgres:testpass@localhost:5498/ferio_control

# Marketplace Plane
MARKETPLACE_DATABASE_URL=postgresql://postgres:testpass@localhost:5498/ferio_marketplace

# Legacy (auth module still uses it)
DATABASE_URL=postgresql://postgres:testpass@localhost:5498/ferio_marketplace

# Tenant plane (injected per-tenant by provisioning; set default here)
TENANT_DATABASE_URL=postgresql://postgres:testpass@localhost:5498/tenant_sheakh_fam
TENANT_DB_HOST=localhost
TENANT_DB_PORT=5498
TENANT_DB_USERNAME=postgres
TENANT_DB_PASSWORD=testpass

# Identity
JWT_ACCESS_SECRET=<64-char-random-string>

# Google OAuth (optional — enables Google Sign-In button)
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-secret

# Server
PORT=6799
API_PREFIX=api/v1
```

Frontend `.env.local` files (per app):

```env
# ferio-marketplace-web/.env.local
NEXT_PUBLIC_API_URL=http://localhost:6799/api/v1
NEXT_PUBLIC_GOOGLE_CLIENT_ID=same-google-client-id
```

---

## 3. Prisma Setup

All commands run from `ferio-nest-prisma/`.

### Generate all clients

```bash
cd ferio-nest-prisma

# All three planes at once
pnpm run prisma:platform:generate

# Legacy client (for auth module)
npx prisma generate
```

### Push schemas to databases (development)

```bash
# Control plane
CONTROL_PLANE_DATABASE_URL="postgresql://postgres:testpass@localhost:5498/ferio_control" \
  npx prisma db push --config prisma/control-plane/prisma.config.ts

# Marketplace plane
MARKETPLACE_DATABASE_URL="postgresql://postgres:testpass@localhost:5498/ferio_marketplace" \
  npx prisma db push --config prisma/marketplace/prisma.config.ts

# Legacy schema (auth module)
npx prisma db push --schema prisma/schema.prisma
```

⚠️ Prisma's AI-consent guard may block these. Bypass with:
```bash
PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION="<user's consenting message>" npx prisma db push ...
```

### PostGIS DDL (marketplace — generated geometry column + GiST index)

```bash
MARKETPLACE_DATABASE_URL="postgresql://postgres:testpass@localhost:5498/ferio_marketplace" \
  pnpm run prisma:marketplace:sql
```

### Tenant migrations (versioned — use migrate deploy)

```bash
# Against the tenant template or any specific tenant DB
TENANT_DATABASE_URL="postgresql://postgres:testpass@localhost:5498/tenant_sheakh_fam" \
  npx prisma migrate deploy --config prisma/tenant/prisma.config.ts
```

### Seed demo data (optional)

```bash
# Marketplace listings (8 Dhaka properties)
MARKETPLACE_DATABASE_URL="postgresql://postgres:testpass@localhost:5498/ferio_marketplace" \
  npx ts-node --transpile-only prisma/scripts/seed-marketplace-demo.ts

# Platform plans (STARTER, PRO, etc.)
# → via API after server starts: POST /platform/plans/seed
```

---

## 4. Build & Run Backend

```bash
cd ferio-nest-prisma

# Build
pnpm run build

# Start (all env vars from section 2)
CONTROL_PLANE_DATABASE_URL="postgresql://postgres:testpass@localhost:5498/ferio_control" \
MARKETPLACE_DATABASE_URL="postgresql://postgres:testpass@localhost:5498/ferio_marketplace" \
DATABASE_URL="postgresql://postgres:testpass@localhost:5498/ferio_control" \
TENANT_DATABASE_URL="postgresql://postgres:testpass@localhost:5498/tenant_sheakh_fam" \
TENANT_DB_HOST=localhost TENANT_DB_PORT=5498 \
TENANT_DB_USERNAME=postgres TENANT_DB_PASSWORD=testpass \
PORT=6799 \
node dist/src/main.js
```

Server listens on `http://localhost:6799/api/v1`.

Swagger docs: `http://localhost:6799/api/docs`

### Quick health check

```bash
curl http://localhost:6799/api/v1/platform/health
```

### Seed platform data (after first start)

```bash
STAFF=$(curl -s -X POST http://localhost:6799/api/v1/identity/platform/login \
  -H content-type:application/json \
  -d '{"email":"admin@ferio.test","password":"RootAdmin1!"}' | \
  python3 -c "import json,sys;print(json.load(sys.stdin)['data']['token'])")

curl -s -X POST http://localhost:6799/api/v1/platform/plans/seed \
  -H "Authorization: Bearer $STAFF"
```

---

## 5. Run Frontend Apps

Each is a Next.js app in its own directory.

```bash
# Public marketplace (www.ferio.com) — port 3001
cd ferio-marketplace-web && pnpm dev

# SaaS workspace (app.ferio.com) — port 3000
cd ferio-saas-web && pnpm dev

# Platform admin (admin.ferio.com) — port 3002
cd ferio-admin-web && pnpm dev
```

Or from repo root:

```bash
pnpm --filter ferio-marketplace-web dev
pnpm --filter ferio-saas-web dev
pnpm --filter ferio-admin-web dev
```

---

## 6. Testing

### Unit tests (no DB required)

```bash
cd ferio-nest-prisma
npx jest --coverage=false --testPathIgnorePatterns "test/"
```

### Integration verify scripts (require scratch Postgres + running backend not needed — scripts call services directly)

| Script | Tests | Env vars needed |
|---|---|---|
| `test/provisioning.verify.ts` | Provisioning pipeline, idempotency, seeding | CONTROL_PLANE_DATABASE_URL, TENANT_DB_* |
| `test/entitlements.verify.ts` | Quota + feature gates | same |
| `test/iam.verify.ts` | Invite lifecycle + migration orchestrator | same |
| `test/parts-bcd.verify.ts` | Ownership shares, billing hardening, subscription lifecycle | same |
| `test/prog13.verify.ts` | IAM + orchestrator live migration | same |
| `test/prog18.verify.ts` | Inquiry auto-attribution via outbox | same + MARKETPLACE_DATABASE_URL |
| `test/prog19.verify.ts` | Sale offers → counter → accept-counter → SOLD | same |
| `test/prog20.verify.ts` | Lead viewings + commission payout settle | same |
| `test/prog21.verify.ts` | Owner portal portfolio snapshot | same |
| `test/prog23.verify.ts` | Automation rules, idempotency, dry-run, webhook failure | same |

Run example:

```bash
CONTROL_PLANE_DATABASE_URL="..." DATABASE_URL="..." \
TENANT_DB_HOST=localhost TENANT_DB_PORT=5498 \
TENANT_DB_USERNAME=postgres TENANT_DB_PASSWORD=testpass \
npx ts-node --transpile-only -r tsconfig-paths/register test/provisioning.verify.ts
```

---

## 7. Useful Operations

### Create a platform staff user

```bash
CONTROL_PLANE_DATABASE_URL="postgresql://postgres:testpass@localhost:5498/ferio_control" \
npx ts-node --transpile-only prisma/scripts/create-platform-admin.ts \
  admin@ferio.test 'YourPassword123!' 'Admin Name' SUPER_ADMIN
```

### Apply marketplace PostGIS DDL (generated geometry + GiST index)

```bash
MARKETPLACE_DATABASE_URL="postgresql://postgres:testpass@localhost:5498/ferio_marketplace" \
  npx ts-node --transpile-only prisma/scripts/apply-marketplace-sql.ts
```

### Seed demo marketplace listings

```bash
MARKETPLACE_DATABASE_URL="postgresql://postgres:testpass@localhost:5498/ferio_marketplace" \
  npx ts-node --transpile-only prisma/scripts/seed-marketplace-demo.ts
```

### Migrate all tenant databases to latest schema

Via API (requires platform staff token):
```bash
curl -X POST http://localhost:6799/api/v1/platform/tenant-db/migrate \
  -H "Authorization: Bearer $TOKEN" \
  -H content-type:application/json \
  -d '{"all": true}'
```

### Reconcile marketplace projections for an org

```bash
curl -X POST http://localhost:6799/api/v1/platform/organizations/<orgId>/outbox/reconcile \
  -H "Authorization: Bearer $TOKEN"
```

---

## 8. Port Map

| Service | Port | Notes |
|---|---|---|
| Backend API | 6799 (dev) | Set PORT env var |
| ferio-marketplace-web | 3001 | www.ferio.com |
| ferio-saas-web | 3000 | app.ferio.com |
| ferio-admin-web | 3002 | admin.ferio.com |
| ferio-pg-gis (Docker) | 5498→5432 | PostGIS scratch |
| ferio-pg-test (Docker) | 5499→5432 | Plain PG scratch |

⚠️ Ports 6733–6734 are occupied by another project (`e-com-nextjs`). Use 6799+.
