All 5 Projects: Build & Runtime Status
✅ All Build Clean (exit=0, zero errors)
Project	Build	API Wired
ferio-nest-prisma	✅ 0 errors	N/A (IS the API)
ferio-marketplace-web	✅	✅ /marketplace/*
ferio-saas-web	✅	✅ /tenant/* + /owner/*
ferio-admin-web	✅	✅ /platform/*
ferio-rental-web	✅	❌ Legacy mock
Live Smoke Test Results (backend on :6799)
✅ Identity login → token issued
✅ Marketplace search → 16 listings returned
✅ Platform analytics → 3 orgs, MRR computed, listing counts by status
✅ Tenant properties → accessible w/ correct membership
❌ Non-member access → correctly blocked (isolation working)
Known Issues (none are build blockers)
Issue	Impact
ferio-rental-web is a legacy duplicate	Confusion only — not referenced by any other code
Docker containers exit after host sleep	Scratch DBs unavailable until restarted
Prisma consent guard blocks CLI commands in AI sessions	Annoying but intentional
Frontend .env.local not committed	Each app needs its own created from .env.example
Quick Start (from scratch)
# 1. Start databases
docker start ferio-pg-gis ferio-pg-test 2>/dev/null || true

# 2. Push schemas
cd ferio-nest-prisma
CONTROL_PLANE_DATABASE_URL="postgresql://postgres:testpass@localhost:5498/ferio_control" \
  npx prisma db push --config prisma/control-plane/prisma.config.ts
MARKETPLACE_DATABASE_URL="postgresql://postgres:testpass@localhost:5498/ferio_marketplace" \
  npx prisma db push --config prisma/marketplace/prisma.config.ts

# 3. Apply PostGIS DDL
MARKETPLACE_DATABASE_URL="postgresql://postgres:testpass@localhost:5498/ferio_marketplace" \
  pnpm prisma:marketplace:sql

# 4. Seed demo data
MARKETPLACE_DATABASE_URL="postgresql://postgres:testpass@localhost:5498/ferio_marketplace" \
  npx ts-node --transpile-only prisma/scripts/seed-marketplace-demo.ts

# 5. Start backend
CONTROL_PLANE_DATABASE_URL="..." MARKETPLACE_DATABASE_URL="..." \
TENANT_DB_HOST=localhost TENANT_DB_PORT=5498 TENANT_DB_USERNAME=postgres \
TENANT_DB_PASSWORD=testpass PORT=6799 node dist/src/main.js

# 6. Start frontends (separate terminals)
cd ../ferio-marketplace-web && pnpm dev   # :3001
cd ../ferio-saas-web && pnpm dev          # :3000
cd ../ferio-admin-web && pnpm dev         # :3002