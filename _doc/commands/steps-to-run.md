# Ferio Property Platform — Steps to Run

Two modes supported:

| Mode | Command | What runs |
|---|---|---|
| **Normal (dev)** | `docker compose up -d` + `pnpm run dev` | Postgres+Redis in Docker, apps on host with hot-reload |
| **Full Docker** | `docker compose --profile full up -d --build` | Everything inside Docker, one command |

---

## Prerequisites

| Tool | Check | Install |
|---|---|---|
| Node.js ≥ 22 | `node -v` | [nodejs.org](https://nodejs.org) |
| pnpm ≥ 9 | `pnpm -v` | `npm i -g pnpm` |
| Docker Compose | `docker compose version` | [docs.docker.com](https://docs.docker.com/compose/install/) |

---

## Mode 1 — Normal Development (Recommended)

Only Postgres+Redis run in Docker. Apps run natively with hot-reload.

### 1a. Start Infrastructure

```bash
cd ferio-rental
docker compose up -d
sleep 5 && docker exec ferio-pg pg_isready -U postgres
```

### 1b. Create Databases (first time only)

```bash
docker exec ferio-pg psql -U postgres -c "CREATE DATABASE ferio_marketplace;"
docker exec ferio-pg psql -U postgres -c "CREATE DATABASE tenant_sheakh_fam;"
```

### 1c. Backend Setup

```bash
cd ferio-nest-prisma
pnpm install
pnpm run prisma:platform:generate
npx prisma db push --config prisma/control-plane/prisma.config.ts
npx prisma db push --config prisma/marketplace/prisma.config.ts
npx prisma migrate deploy --config prisma/tenant/prisma.config.ts TENANT_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/tenant_sheakh_fam
pnpm run prisma:marketplace:sql
npx ts-node --transpile-only prisma/scripts/seed-ci.ts
```

### 1d. Start Backend

```bash
pnpm run build
pnpm run start:dev
# → http://localhost:6733
```

### 1e. Provision Workspace (first time only)

```bash
STAFF=$(curl -s -X POST http://localhost:6733/api/v1/identity/platform/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@ferio.test","password":"RootAdmin1!"}' \
  | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{console.log(JSON.parse(d).data.token)})")

OWNER_TOKEN=$(curl -s -X POST http://localhost:6733/api/v1/identity/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"owner@demo.test","password":"supersecret1"}' \
  | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{console.log(JSON.parse(d).data.token)})")

OWNER_ID=$(curl -s http://localhost:6733/api/v1/identity/me \
  -H "Authorization: Bearer $OWNER_TOKEN" \
  | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{console.log(JSON.parse(d).data.userId)})")

curl -s -X POST http://localhost:6733/api/v1/platform/organizations \
  -H "Authorization: Bearer $STAFF" -H 'Content-Type: application/json' \
  -d "{\"name\":\"Sheakh Family Properties\",\"slug\":\"sheakh-fam\",\"planTier\":\"PRO\",\"ownerUserId\":\"$OWNER_ID\"}"
```

### 1f. Start Frontends (three terminals)

```bash
# Terminal 1 — Marketplace
cd ferio-marketplace-web && pnpm install && pnpm run dev
# → http://localhost:3001

# Terminal 2 — SaaS Dashboard
cd ferio-saas-web && pnpm install && pnpm run dev
# → http://localhost:3000

# Terminal 3 — Admin Console
cd ferio-admin-web && pnpm install && pnpm run dev
# → http://localhost:3002
```

### Verify

Open **http://localhost:3001** → search bar visible → Post Property → login as owner → submit ad → approve at admin console (`admin@ferio.test` / `RootAdmin1!`) → listing appears on map.

---

## Mode 2 — Full Docker (One Command)

Everything runs inside Docker. No Node.js/pnpm needed on host.

```bash
cd ferio-rental
docker compose --profile full up -d --build
```

First time only — create the marketplace database and seed:

```bash
docker exec ferio-pg psql -U postgres -c "CREATE DATABASE ferio_marketplace;"
docker exec ferio-api npx prisma db push --config prisma/marketplane/prisma.config.ts \
  MARKETPLACE_DATABASE_URL=postgresql://postgres:postgres@postgres:5432/ferio_marketplace
docker exec ferio-api pnpm run prisma:marketplace:sql
docker exec ferio-api npx ts-node --transpile-only prisma/scripts/seed-ci.ts
```

| Service | URL |
|---|---|
| API | http://localhost:6733 |
| Marketplace Web | http://localhost:3001 |
| SaaS Dashboard | http://localhost:3000 |
| Admin Console | http://localhost:3002 |

---

## Demo Accounts

| Role | Email | Password |
|---|---|---|
| Platform Admin | `admin@ferio.test` | `RootAdmin1!` |
| Workspace Owner | `owner@demo.test` | `supersecret1` |

---

## Stopping

```bash
# Normal mode: Ctrl+C each terminal, then:
docker compose down

# Full Docker mode:
docker compose --profile full down

# Delete ALL data too:
docker compose --profile full down -v
```

---

## Backend Scripts Reference

```bash
cd ferio-nest-prisma

pnpm run build                          # Build all NestJS modules
pnpm run start:dev                      # Hot-reload dev server
pnpm run start:prod                     # Production server
pnpm run prisma:platform:generate       # Generate 3 Prisma clients
pnpm run prisma:control:push            # Push control-plane schema
pnpm run prisma:marketplace:push        # Push marketplace schema
pnpm run prisma:marketplace:sql         # Apply raw SQL migrations
pnpm run prisma:tenant:push             # Push tenant template schema
pnpm run lint                           # ESLint auto-fix
pnpm run test                           # Jest unit tests
```

---

## Environment Files

Pre-filled for local development. No secrets needed.

| Project | File | Key Variables |
|---|---|---|
| Backend | `ferio-nest-prisma/.env` | DB URLs, JWT secrets, storage driver, gateway driver |
| Marketplace Web | `ferio-marketplace-web/.env` | `NEXT_PUBLIC_API_URL` |
| SaaS Web | `ferio-saas-web/.env` | Same API URL + tenant slug |
| Admin Web | `ferio-admin-web/.env` | Same API URL |

For production, update `.env`: set `NODE_ENV=production`, real DB URLs, payment gateway credentials (`PAYMENT_GATEWAY_DRIVER=bkash` + provider env vars), `STORAGE_DRIVER=s3` + bucket creds, strong JWT secrets.
