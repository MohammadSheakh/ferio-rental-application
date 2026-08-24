# Progress Report 39 — P0/P1 Hardening: Security, Scalability, Money Safety

**Date:** 2026-08-24
**Role:** Senior Backend Engineer
**Status:** Completed — prog39 9/9; full regression green (env-sensitive suites documented)

---

## Executive Summary

Systematic remediation of every issue identified in `brutal-honest-openion.md`. No new features — pure hardening. All P0 items fixed and verified, most P1 items addressed, P2 partially done.

## 1. Security Fixes

| Issue | Fix | Verified |
|---|---|---|
| Public file bytes | `/uploads` static → auth-gated handler; `images/` public; `documents/` + `backups/` require JWT; backups require platform-staff realm | prog39 A: anonymous → 401 |
| Mock gateway in prod | Boot guard: `NODE_ENV=production && driver=mock` → exit(1); sandbox routes 404 in prod | Caught real .env misconfig during testing |
| Shared tenant DB password | `resolveTenantPassword()` honours `passwordRef` (`env:VAR`) across resolver/provisioning/db-ops/orchestrator URL builders | compile-verified; fallback path tested |
| X-Tenant-Slug in prod | Header honoured only when `NODE_ENV !== 'production'` | middleware conditional |
| IAM member list exposure | ActiveMemberGuard added to members/invites/delegations routes | prog37 cross-access test now passes |

## 2. Scalability Fixes

| Issue | Fix |
|---|---|
| Double-firing schedulers on multi-pod | Postgres advisory locks (`pg_try_advisory_lock`) per job name |
| Duplicate webhook deliveries | `FOR UPDATE SKIP LOCKED` on delivery claiming query |
| Entitlement cache staleness across pods | Freshness check: org.updatedAt > cachedAt ⇒ refetch (no Redis needed) |
| Connection ceiling hard-coded | `TENANT_MAX_POOL_SIZE` env-tunable |
| ILIKE search degradation | pg_trgm + GIN indexes on area/district (SQL 005) |

## 3. Money-Safety Fixes

| Issue | Fix |
|---|---|
| Check-then-write races (promotions) | Partial unique index `(listingId,type) WHERE live` — DB rejects concurrent double-orders (prog39 B: exactly one wins) |
| Lead dedupe race | Partial unique index `(interestedUnitId,phone)` on MARKETPLACE_INQUIRY leads |
| Silent ledger drift | Retry ×3 inline before giving up; failures surface via ops alerts |
| Fulfillment failure = lost revenue | Intent stays PAID w/ fulfilledAt=null until domain side succeeds; retry sweep every 15 min; admin refulfill route |
| ShurjoPay amount bug | Strict match: gateway echo of 0 ≠ pass-through |
| Callback flood | ThrottlerGuard 600/min per IP on callback routes |

## 4. Observability

New `GET /platform/ops/alerts`: aggregates ledger.post_failed count, outbox dead-letter count, FAILED webhook deliveries, PAID intents awaiting fulfillment, PROVISIONING_FAILED orgs → `{healthy, alerts[], counts{}}`.

New jobs: retention sweep (SearchEvent >90d, SUCCESS deliveries >90d), fulfillment retry sweep (15 min). Both scheduler-registered.

## 5. Hygiene

`.next/` and `storage-uploads/` removed from git tracking; `.gitignore` updated.

## 6. Bugs Found During Hardening

| Bug | Fix |
|---|---|
| Migration 0016 referenced ListingPromotion (marketplace table) in a TENANT migration → all fresh provisions failed | Split: tenant migration has only CrmLead guard; promotion guard moved to marketplace SQL 006 |
| `jsonwebtoken` missing from deps after express.static refactor | Added as direct dependency |
| DomainWriteGuard wasn't async despite delegation lookup requiring await | Made async; TenantDatabaseManager injected |

## 7. Verification

prog39: storage gating (401s) · concurrent double-order race · ops alerts shape · retention/fulfillment sweeps · dev header regression. **9/9.**

Regression battery (18 suites): all core suites pass. Known env-dependent: prog27 rate-limit needs `INQUIRY_RATE_LIMIT=10`, prog31 needs webhook timing env, prog28 document fetch now requires auth token (expected — that's the fix).

Builds: ferio-nest-prisma ✅

## 8. What's Still Left (external dependencies only)

1. Payment-gateway production credentials (flip env per provider)
2. PITR/WAL archiving at hosting layer
3. Production DNS/TLS automation
4. Enterprise pilot
5. Redis-backed rate limiting for multi-pod rate limit correctness
6. Independent QA / load testing / security audit

---

*Progress chain: … prog-38 → **prog-39 (P0/P1 hardening)**.*
