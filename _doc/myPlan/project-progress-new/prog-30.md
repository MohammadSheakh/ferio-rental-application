# Progress Report 30 — § Gate 5 Double-Entry Ledger

**Date:** 2026-08-24
**Role:** Senior Solution Architect & Full-Stack Developer
**Status:** Completed — prog30 12/12; full regression battery **13 suites / 140 assertions** green

---

## Executive Summary

Closed the ledger-readiness gap (Week 15) and the financial-correctness core of Gate 5: every money-moving event now writes a **balanced double-entry group**, and a trial-balance endpoint proves the books never drift.

## 1. Ledger Design (`LedgerEntry`, migration `0011`)

One row per leg; invariants enforced by `TenantLedgerService.postGroup` **before insert**:
- Σ debit == Σ credit per groupId (tolerance half-paisa) — unbalanced postings are rejected outright
- At least two legs; idempotent re-post returns the existing group
- Account naming: `CASH · BKASH · NAGAD · BANK · {CATEGORY}_RECEIVABLE · MAINTENANCE_EXPENSE · RENTER_PAYABLE · ACCOUNTS_PAYABLE`

## 2. Posting Rules Now Live

| Event | Group | Entries |
|---|---|---|
| Payment verified | `payment:verify:<id>` | Dr cash-by-method · Cr `{category}_RECEIVABLE` split proportionally across invoice lines (largest-remainder paisa) |
| Payment reversed | `payment:reverse:<id>` | Exact mirror of the original group |
| Work order completed w/ cost | `wo-complete:<id>` | Dr MAINTENANCE_EXPENSE · Cr ACCOUNTS_PAYABLE (RENTER payer → RENTER_PAYABLE) |

Verification failures degrade safely: a ledger error cannot block payment verification (logged to tenant audit as `ledger.post_failed`).

New endpoints:
- `PATCH /tenant/maintenance/work-orders/:id/complete {cost, afterPhotoUrl?}` — completion + actual-cost capture + posting
- `GET /tenant/reports/trial-balance` — per-account totals + global drift (always 0)
- `GET /tenant/reports/ledger/:groupId` — inspect any posting group

## 3. Verified (prog30.verify.ts)

৳10,000 bKash verified against a ৳20,000-rent + ৳5,000-service invoice → BKASH Dr 10,000, Cr RENT_RECEIVABLE 8,000 + SERVICE_CHARGE_RECEIVABLE 2,000 (proportional). Reversal mirrors. Geyser work order completed at ৳4,000 → expense/payable pair. Trial balance drift ৳0 at every step. **12/12.**

Regression battery: prog13 19 · prog14 5 · prog17 11 · prog18 4 · prog19 10 · prog20 9 · prog21 9 · prog22 5 · prog26 21 · prog27 10 · prog28 11 · prog29 14 · prog30 12 = **140/140 ✅**

Builds: ferio-nest-prisma ✅

## 4. Remaining Next Steps

1. External API & webhooks (W33): API keys/scopes/rate limits; signed webhook subscriptions with delivery logs + retry/replay.
2. Custom domains (W26).
3. Gateway integrations for platform billing + promotion payments.
4. Ledger coverage widening: utility bill posting legs, commission payouts, deposit accounting.

---

*Progress chain: … prog-29 → **prog-30 (double-entry ledger)**.*
