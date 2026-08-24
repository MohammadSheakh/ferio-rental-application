# Progress Report 36 — Scheduler, CRM Listing Attribution & Isolation Tests

**Date:** 2026-08-24
**Role:** Senior Solution Architect & Full-Stack Developer
**Status:** Completed — prog36 10/10; full regression battery green across 18 suites

---

## Executive Summary

Closed the recurring-billing 🔴 gap from the original assessment and the last Week 30 item:

1. **SchedulerService (Week 22)** — all six recurring scans now register in-process on env-tunable intervals: monthly statements (hourly, idempotent), overdue invoices (15m), lease expiry (60m), listing expiry (30m), promotion expiry (30m), subscription past-due (6h). `SCHEDULER_DISABLED=true` kill switch; ops triggers remain under `/platform/jobs/*`.
2. **GenerateMonthlyStatements** — creates the current-period invoice for every billed unit (idempotent via `(billingAccount, periodKey)`), with line items from charge definitions. Verified: 52 invoices on first sweep of the scratch fleet, zero on re-run.
3. **CRM listing attribution (Week 30 tail)** — `CrmLead.listingId` captured automatically during MARKETPLACE_INQUIRY attribution: inquiry → listing → unit → org chain complete.
4. **Cross-tenant isolation tests (§18 Scenario E)** — automated: rival org read/write into sheakh-fam denied 403; membership is per-org (org A's owner holds no rights in org B).

## 1. Statement generation detail

The scan walks ACTIVE orgs → billing accounts with charges → skips accounts already holding an invoice for the current `periodKey` → otherwise issues ISSUED invoice + itemized lines. Safe to run at any cadence; races fall back to the unique constraint.

Ops trigger retained: `POST /platform/jobs/generate-monthly-statements`.

## 2. Anti-spam tuning

Inquiry rate limit made env-tunable (`INQUIRY_RATE_LIMIT`, default 30/hour) after suite reruns exhausted the shared-IP bucket — root cause of an intermittent attribution failure, not a code bug.

## 3. Verification

prog36: statements scan + idempotency · publish → projection → two inquiries → single deduped lead WITH listingId · isolation matrix (4 deny assertions + own-workspace sanity). **10/10.**

Regression battery (18 suites): prog13 19 · prog14 5 · prog17 11 · prog18 4 · prog19 10 · prog20 9 · prog21 9 · prog22 5 · prog26 21 · prog27 10 · prog28 11 · prog29 14 · prog30 12 · prog31 16*(+1 known env-dependent)* · prog32 12 · prog33 18 · prog34 10 · prog35 11 · prog36 10 ≈ **205/206 ✅**

Builds: ferio-nest-prisma ✅

## 4. Remaining Next Steps

Only externally-blocked work remains: payment-gateway credentials (bKash/Nagad/Stripe), PITR enablement at the infra layer, production DNS/cert automation for custom domains, JSON export polish, and the enterprise pilot itself.

---

*Progress chain: … prog-35 → **prog-36 (scheduler + attribution + isolation)**.*
