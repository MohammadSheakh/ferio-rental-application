# Progress Report 29 — § W27 Platform Billing + Utility Allocation Engine

**Date:** 2026-08-24
**Role:** Senior Solution Architect & Full-Stack Developer
**Status:** Completed — prog29 14/14; full regression battery **12 suites / 128 assertions** green

---

## Executive Summary

Closed the two biggest remaining financial gaps:

1. **Platform billing (Week 27)** — Ferio now invoices and collects subscription fees from organizations, completing the Organization → Ferio money flow with its own ledger in the control plane.
2. **Utility allocation engine (Weeks 17–18)** — shared building bills now split across units with six allocation methods, exact paisa rounding, duplicate-reading prevention, and one-command posting onto renter statements.

Plus a promotion upsell on the `/post` success screen.

## 1. Platform Billing (§ Week 27)

### Schema (control plane, db push to scratch)
- `PlatformInvoice` — unique `(subscriptionId, periodKey)` → idempotent generation; DUE/PAID/VOID
- `PlatformPayment` — method/reference/recordedBy; partial payments supported

### Flow
```
self-serve provision ──→ first invoice returned in response (DUE)
POST /platform/jobs/generate-subscription-invoices  (idempotent backfill for all ACTIVE subs)
POST /platform/billing/invoices/:id/payments {method, amountBdt?, reference}
   → staff confirm → PAID + paidAt when covered; overpay blocked
GET /platform/billing/invoices?organizationId=&status=
```
Ledger separation holds: subscription money lives in the CONTROL plane only — never merged with rent (tenant DBs) or promotion revenue (marketplace DB).

## 2. Utility Allocation Engine

Migration `0010_utility_allocations`: `UtilityAllocation` rows (unique per bill+unit) + `UtilityAccount.propertyId` anchor for building-scope accounts.

`POST /tenant/utilities/bills` now computes per-unit shares:
| Method | Weight |
|---|---|
| EQUAL | 1 per unit |
| AREA | unit areaSqFt |
| OCCUPANCY | ACTIVE lease presence |
| SUBMETER | Σ kWh readings in window from same-type unit accounts |
| PERCENTAGE | explicit weights (must total 100%) |
| MANUAL | explicit lines (must total the bill) |

**Exact rounding:** largest-remainder in paisa — Σ shares == bill total always (verified: ৳1000 over 1000/2000/3000 sqft → 166.67/333.33/500).

Guards added: one reading per meter per calendar month (400 otherwise), currentReading ≥ previousReading, PERCENTAGE/MANUAL sum validation.

**Posting:** `POST /tenant/utility-bills/:id/post` appends each unit's share as an itemized line (`DESCO 2026-08`) on that unit's OPEN invoice for the period — idempotent, units without statements reported as skipped.

## 3. Frontend
`/post` success screen gains an optional boost picker: catalog-driven type × duration grid with live pricing → order placed (PENDING_PAYMENT), with pay-by-MFS instructions. Builds clean.

## 4. Verification (prog29.verify.ts)

Platform: scan → first-invoice-at-provisioning (৳999 STARTER) → partial ৳500 → settle → PAID w/ paidAt → double-pay blocked.
Utilities: EQUAL 300×3 · SUBMETER 150/300/450 by consumption · AREA exact rounding · PERCENTAGE validation · dup-month reading blocked · posting charges unit A while skipping B/C. **14/14.**

Regression battery: prog13 19 · prog14 5 · prog17 11 · prog18 4 · prog19 10 · prog20 9 · prog21 9 · prog22 5 · prog26 21 · prog27 10 · prog28 11 · prog29 14 = **128/128 ✅**

Builds: ferio-nest-prisma ✅ · ferio-marketplace-web ✅

## 5. Remaining Next Steps

1. External API & webhooks surface (W33): API keys, scopes, rate limits, delivery logs.
2. Custom domains (W26): CNAME verification + SSL workflow.
3. LedgerEntry double-entry posting behind payment verification (audit-grade books).
4. Payment-gateway integration to replace manual MFS confirmation (platform billing + promotions).

---

*Progress chain: … prog-28 → **prog-29 (platform billing + utility allocation)**.*
