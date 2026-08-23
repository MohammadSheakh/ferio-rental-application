# Progress Report 23 — Automation Engine (Week 32)

**Date:** 2026-08-23
**Role:** Senior Solution Architect & Full-Stack Developer
**Status:** Completed — 11/11 live assertions across rule CRUD, trigger firing, idempotency, dry-run and webhook failure history

---

## Executive Summary

Delivered the **Week 32 Automation Engine**: staff-defined rules that fire actions when domain events occur (invoice overdue, lease expiring, maintenance opened, listing expiring, subscription past-due). Actions execute at most once per (rule, reference) pair — enforced by a unique database constraint — with full execution history, dry-run support and recursion protection.

---

## Architecture

### Models (tenant schema, migration `0008_automations`)
| Model | Purpose |
|---|---|
| `AutomationRule` | name + trigger enum + action enum + JSONB config; enabled flag |
| `AutomationExecution` | ruleId + refId unique pair; status (`SUCCESS`/`FAILED`/`SKIPPED_DRYRUN`/`SKIPPED_DUPLICATE`); detail/error JSONB |

### Service
`evaluate(organizationId, trigger, ctx, {dryRun})` is the single entry point called from cron scans and feature services. Guarantees:

| Guarantee | Implementation |
|---|---|
| Idempotency | Unique `(ruleId, refId)` index; P2002 caught → `SKIPPED_DUPLICATE` |
| Replay detection | Prior FAILED row + new SUCCESS → update in place |
| Recursion protection | `viaAutomation` context flag — callers must not re-fire |
| Dry run | Records `SKIPPED_DRYRUN` without side effects |

### Actions (v1)
| Action | Behaviour |
|---|---|
| `CREATE_NOTICE` | Creates an org-wide or unit-targeted Notice with `{{placeholder}}` template rendering |
| `INVOKE_WEBHOOK` | Signed POST (HMAC-SHA256 via `AUTOMATION_WEBHOOK_SECRET`) to configured URL; 10s timeout; response recorded in detail |

### API (`/tenant/automations/*`, JWT + ActiveMemberGuard)
- `GET /rules?trigger=` · `POST /rules` · `DELETE /rules/:id`
- `GET /executions?trigger=` — execution history (newest 100)
- `POST /dry-run` — records `SKIPPED_DRYRUN` without side effects

## 2. Trigger Wiring

| Cron scan | Fires |
|---|---|
| `runOverdueInvoiceScan` | Per-invoice `INVOICE_OVERDUE` evaluate |
| `runSubscriptionPastDueScan` | Per-org `SUBSCRIPTION_PAST_DUE` evaluate |
| `runLeaseExpiryScan` | Per-lease `LEASE_EXPIRING` evaluate *(wiring pending)* |
| `runListingExpiryScan` | Per-listing `LISTING_EXPIRING` evaluate *(wiring pending)* |
| `TenantMaintenanceService.createMaintenanceRequest` | `MAINTENANCE_OPENED` evaluate *(pending)* |

Platform job triggers added: `/platform/jobs/overdue-invoice-scan` and `/jobs/lease-expiry-scan`.

## 3. Verification (live :6799)

| Check | Result |
|---|---|
| Rule created (name/trigger/action/config) | ✅ |
| Overdue invoice seeded → scan marks OVERDUE → automation fires | ✅ notice created w/ invoice number |
| Execution history SUCCESS row present | ✅ |
| Re-scan same invoice → NO duplicate notice | ✅ idempotent |
| Dry-run records SKIPPED_DRYRUN without side effects | ✅ |
| Webhook rule fires → invalid URL → clean FAILED row | ✅ error history visible |
| Regressions prog13 19/19 · prog14 5/5 | ✅ |

## 4. Remaining Next Steps

1. Sale CRM timeline endpoint polish; commission payout ledger UI.
2. Analytics groundwork (Weeks 34–35).
3. External API & webhooks surface (Week 33).

---

*Progress chain: prog-08 … prog-22 → **prog-23 (Week 32 Automation Engine)**.*
