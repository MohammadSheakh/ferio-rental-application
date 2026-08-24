# Progress Report 34 — § Week 36 Tenant DB Operations + PWA Offline Shell

**Date:** 2026-08-24
**Role:** Senior Solution Architect & Full-Stack Developer
**Status:** Completed — prog34 10/10; full regression battery green (env-sensitive suites verified on a union-env instance)

---

## Executive Summary

Delivered the Week 36 operations block: **physical tenant backups, readability verification, clone-to-staging, archive lockout and connection metrics** — plus the marketplace PWA offline shell.

## 1. Tenant Backup Lifecycle (`TenantDbOpsService`)

```
POST /platform/organizations/:id/backups        → pg_dump -Fc → StorageService (S3/local)
GET  /platform/backups[?organizationId=]         → listing w/ size · table count · verifiedAt
POST /platform/backups/:id/verify                → pg_restore --list readability proof
POST /platform/backups/:id/clone                 → restore into standalone <db>_clone_<ts>
POST /platform/organizations/:id/archive|unarchive → DISABLED/READY + pooled-connection drop
GET  /platform/tenant-db/metrics                 → pool stats · fleet status · backup totals
```

Verified live: 37 tables / 147KB backup of `tenant_sheakh_fam`, archive readable (37 entries), clone restored with 37 tables, archive lockout returned 404 at the resolver mid-session and full service resumed after unarchive.

## 2. Issues Found & Fixed En Route

| Issue | Root cause | Fix |
|---|---|---|
| pg_dump "server does not support SSL" | node-pg ≥8 treats `sslmode=prefer` strictly; ops connections inherited the DB row's mode | count-tables client connects directly, TLS only via explicit `TENANT_DB_SSL=true`; pg_dump URL uses prefer (libpq falls back correctly) |
| Clone failed: PG16 rejected `SET transaction_timeout` | host pg_dump is v18; dumps carry PG17-only SET statements | convert archive to SQL via `pg_restore -f`, strip server-only SET lines, apply with psql |
| Webhook worker error spam on legacy scratch orgs | two org DBs predated migrations 0009–0012 | brought whole scratch fleet to the current chain |

## 3. PWA Service Worker (Week 28 tail)

Conservative offline shell for ferio.com: runtime cache-first for same-origin static assets, network-first navigations with cached-page fallback. Registered production-only via `ServiceWorkerRegistrar`. Builds clean.

## 4. Verification

prog34: backup → verify → clone → archive lockout → unarchive recovery → metrics/listing. **10/10.**

Regression battery: prog13 19 · prog14 5 · prog17 11 · prog18 4 · prog19 10 · prog20 9 · prog21 9 · prog22 5 · prog26 21 · prog27 10 · prog28 11 · prog29 14 · prog30 12 · **prog31 17 · prog32 12 · prog33 18 · prog34 10** = **185/185 ✅** (env-sensitive suites run against an instance carrying their env: rate-limit, webhook timing, mock DNS).

Builds: ferio-nest-prisma ✅ · ferio-marketplace-web ✅

## 5. Remaining Next Steps

1. Payment-gateway integrations (bKash/Nagad/Stripe) — needs merchant credentials.
2. DR runbooks + PITR configuration (W37) — infra-side companion to today's tooling.
3. Data-portability JSON export; IAM delegation; API key rotation UX.

---

*Progress chain: … prog-33 → **prog-34 (tenant DB operations)**.*
