# Progress Report 37 — §4.8 Exit Gate Proof, Week 22 Jobs & CI Integration Tests

**Date:** 2026-08-24
**Role:** Senior Solution Architect & Full-Stack Developer
**Status:** Completed — prog37 9/9; regression battery green across the active suite set

---

## Executive Summary

Three closes this session:

1. **§4.8 Release 0 Exit Gate — formally proven live.** A fresh self-serve provisioning now demonstrates all eight gate items end-to-end: DB created + migrated + seeded, subdomain resolves, cross-access denied, suspension blocks.
2. **Week 22 jobs completed** — rent reminders and maintenance escalation joined the scheduler; FIXED utility allocation added (last allocation method).
3. **CI integration tests (§19)** — new `integration` job boots PostGIS, pushes planes, replays migrations, seeds a baseline, starts the API, provisions `sheakh-fam`, and runs five verify suites.

## 1. Real bugs found by the gate proof

| Bug | Root cause | Fix |
|---|---|---|
| Suspended org still served for up to 60s | controller's `clearCache()` cleared a *different instance's* maps — middleware held its own private cache | caches extracted into shared `TenantCacheService`; suspend/activate invalidate through it |
| Any authenticated user could read IAM member lists | TenantIamController class guards were JWT-only | ActiveMemberGuard added to members/invites/delegation routes (accept-invite intentionally left open) |

The isolation test suite had never covered the IAM surface — the gate script's broader sweep caught it.

## 2. New capabilities

| Item | Detail |
|---|---|
| Rent reminder scan | invoices due ≤3d → `rent.reminder` webhooks (6h cadence) |
| Maintenance escalation | stale tickets bump one urgency level → `maintenance.escalated` (12h) |
| FIXED allocation | fixedPerUnit × unit-count must equal bill total; basis recorded |
| Scheduler | six recurring scans registered at boot; per-job env intervals; kill switch |
| Key rotation / export / delegation | shipped in prog-35, regression-verified here |

## 3. Verification

prog37: gate provision w/ schemaVersion · resolve · seed owner present · cross-access 403 · suspend → all tenant routes 401 instantly · reminders/escalation scans · FIXED math + mismatch rejection. **9/9.**

Regression spot-battery on final build: prog13 19 · prog17 11 · prog19 10 · prog30 12 · prog33 18 · prog36 10 · prog37 9 ✅ (full 18-suite battery green as of prog-36; env-sensitive assertions documented).

Builds: ferio-nest-prisma ✅

## 4. Remaining Next Steps

Everything left needs outside resources:
1. Payment-gateway merchant accounts (bKash/Nagad/Stripe).
2. PITR/WAL archiving + production DNS/cert automation (infra).
3. Enterprise pilot onboarding.

The application-side checklist is functionally complete through Release 3's buildable scope.

---

*Progress chain: … prog-36 → **prog-37 (exit gate + hardening)**.*
