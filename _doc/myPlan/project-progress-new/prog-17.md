# Progress Report 17 — Broker CRM Pipeline, Listing Expiry Job & Ops Triggers

**Date:** 2026-08-23
**Role:** Senior Solution Architect & Fullstack Engineer
**Status:** Completed — 11/11 live assertions (CRM pipeline, conversion with commission capture, expiry job); regressions 19/19 + 5/5

---

## Executive Overview

Delivered **Week 30 Broker CRM groundwork**: a full lead pipeline from first contact through lease conversion with broker-commission capture, plus pipeline reporting. Also shipped the **marketplace listing-expiry job** with an ops trigger, and closed two latent feature gaps (`expiresAt` on listing creation, meter-creation route).

---

## 1. Broker CRM (`/tenant/crm/*`, leasing-domain gated)

### Schema (migration `0005_crm_foundations`)
- `CrmLead`: source (`MARKETPLACE_INQUIRY | WALK_IN | REFERRAL | PHONE | OTHER`), contact, `interestedUnitId`, `assignedTo` (member), `brokerName`, status, `convertedRenterId`, `lostReason`.
- Lease gains broker attribution: `brokerName / brokerCommissionPct / brokerCommissionAmount`.

### Pipeline
Linear state machine with guarded transitions —
`NEW → CONTACTED → VIEWING_SCHEDULED → NEGOTIATING → CONVERTED` (+ `LOST` from any open stage, reason required; re-open allowed).

### Conversion (single transaction)
NEGOTIATING lead → renter row (dedup by phone/email) + **ACTIVE lease** + unit → `OCCUPIED` + lead → `CONVERTED`; commission computed from `monthlyRent × pct%` and stored on the lease; audit event written.

### Reporting
`GET /tenant/crm/report` — counts per status, overall conversion %, per-assignee totals/conversions.

## 2. Listing Expiry Job

- `CronJobsService.runListingExpiryScan()` flips `ACTIVE`/`PENDING_REVIEW` listings past `expiresAt` to `EXPIRED` (stale submissions die too).
- Ops triggers added under platform RBAC: `POST /platform/jobs/expire-listings` and `/jobs/subscription-past-due-scan`.

## 3. Feature gaps closed en route

- `expiresAt` accepted on listing creation (DTO + service) — previously unsettable anywhere.
- `POST /tenant/utilities/meters` route exposed (service existed unexposed).

## 4. Verification (live :6799, fresh-migrated tenant DB)

| Check | Result |
|---|---|
| Lead NEW; illegal jump blocked; walk to NEGOTIATING | ✅ |
| Convert → renter+lease+OCCUPIED+CONVERTED; commission ৳22,500 @50% of 45k | ✅ |
| Report counts/rate/assignee | ✅ |
| LOST without reason blocked; with reason OK | ✅ |
| Expiry scan expired past-dated listings; removed from public search | ✅ |
| Regressions prog13 19/19 · prog14 5/5 | ✅ |

## 5. Session Notes

- Scratch tenant DB rebuilt cleanly from the migration chain after push/migrate drift — production note: fleets migrated via `db push` need **baselining** (`migrate resolve --applied`) before switching to versioned migrations.
- Recurring Nest trap documented twice now: method-level `@UseGuards` replaces class-level guards — always chain explicitly. DTOs without class-validator decorators become empty schemas under the global whitelist pipe.

## 6. Remaining Next Steps

1. Sale CRM (Week 31): buyer profile + offer/negotiation models.
2. Marketplace monetisation hooks (Featured/Boost) as revenue stream 2.
3. Automation engine (Week 32): triggers/actions over existing domain events.

---

*Progress chain: prog-08 … prog-16 → **prog-17 (Broker CRM + expiry ops)**.*
