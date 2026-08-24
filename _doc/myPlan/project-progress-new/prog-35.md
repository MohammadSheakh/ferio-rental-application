# Progress Report 35 — IAM Delegation, Key Rotation, Data Export + DR Runbook

**Date:** 2026-08-24
**Role:** Senior Solution Architect & Full-Stack Developer
**Status:** Completed — prog35 11/11; full regression battery green (prog31 re-verified 17/17 on its env)

---

## Executive Summary

Cleared the remaining small-block items across four weeks:

1. **IAM delegation (Week 9)** — owners grant time-boxed write domains to members; enforced in both domain guards with expiry/revocation.
2. **API key rotation (Week 33)** — atomic rotate: new secret issued once, old revoked, scopes preserved.
3. **Data-portability export (Week 36 close-out)** — `GET /platform/organizations/:id/export` delivers `ferio-export-v1` JSON of all core operational data.
4. **DR runbook (`_doc/runbooks/dr.md`)** — per-plane restore procedures built around the prog-34 tooling, incident roles, severity matrix, quarterly drills.

## 1. Delegation design

Migration `0014_delegations`: `MemberDelegation(from → to, domains[], expiresAt?, revokedAt?)`.

Both write-check paths (class-level ActiveMemberGuard inline check AND method-level DomainWriteGuard) now fall back to an active delegation lookup when the raw role check fails:
```
role fails? → active delegation covering domain
              from an ACTIVE member who holds it? → allow
```
Endpoints (owner-only mutations): `POST/GET/DELETE /tenant/iam/delegations`. Every grant/revoke is tenant-audited.

## 2. Verification (prog35.verify.ts)

VIEWER blocked (403) → owner grants billing (10 min) → same VIEWER generates an invoice (200-level, previously impossible) → owner revokes → blocked again. Non-owner delegation attempt 403. Rotation: old key live → rotate → old dead (401), new live. Export: 194 units / 58 invoices delivered as attachment JSON with counts. **11/11.**

Regression battery: prog13 19 · prog14 5 · prog17 11 · prog18 4 · prog19 10 · prog20 9 · prog21 9 · prog22 5 · prog26 21 · prog27 10 · prog28 11 · prog29 14 · prog30 12 · prog31 17*(own env)* · prog32 12 · prog33 18 · prog34 10 · prog35 11 = **196/196 ✅**

Builds: ferio-nest-prisma ✅ · ferio-marketplace-web ✅

## 3. Debugging note worth keeping

The delegation 403 persisted through one rebuild because **two guards** perform the same role check (ActiveMemberGuard inline + DomainWriteGuard); only one had been patched. Lesson recorded: when a check exists in multiple layers, patch and verify ALL of them — a single green path can mask the other's stale logic.

## 4. Remaining Next Steps

Everything left requires external dependencies or product decisions rather than solo coding:
1. Payment-gateway integrations (bKash/Nagad/Stripe merchant accounts).
2. PITR/WAL-archiving enablement at the infrastructure layer; marketplace/control restore drills.
3. Real-DNS custom-domain rollout (production DNS + reverse-proxy cert automation).

---

*Progress chain: … prog-34 → **prog-35 (delegation + rotation + export + DR runbook)**.*
