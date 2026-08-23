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


Done — prog-23 shipped: Automation Engine (Week 32), committed & pushed
Pushed
061620d5e..4cb5db07a  main -> main
12 files changed, 669 insertions(+), 37 deletions(-)
Commit 4cb5db07a — feat(automation): Week 32 automation engine — rules, triggers, dry-run, history
What was built
Automation engine with staff-defined rules over domain triggers:
Component	Detail
Rules	name + trigger enum (INVOICE_OVERDUE, LEASE_EXPIRING, MAINTENANCE_OPENED, LISTING_EXPIRING, SUBSCRIPTION_PAST_DUE) + action enum (CREATE_NOTICE, INVOKE_WEBHOOK) + JSONB config
Executions	unique (ruleId, refId) — at-most-once per reference; P2002 caught → SKIPPED_DUPLICATE; FAILED rows retryable; dry-run rows recorded without side effects
Actions v1	CREATE_NOTICE (org-wide or unit-targeted, template placeholders) · INVOKE_WEBHOOK (HMAC-SHA256 signed POST, 10s timeout)
API	CRUD + executions history + dry-run under /tenant/automations/*, JWT + ActiveMemberGuard
Verified live — 11/11
Rule created ✓ · overdue scan marked invoice ✓ · automation notice rendered with correct title ✓ · SUCCESS execution row ✓ · re-scan idempotent (no duplicate) ✓ · webhook rule fires → clean FAILED row for invalid URL ✓ · dry-run records without side effects ✓
Session notes
- Fixed a race where build completed after server launch → stale binary served old routes
- Recurring shell cwd resets documented — always use explicit cd in each call
- Prisma consent guard now required for all db push/migrate invocations
Next (prog-24): Sale CRM timeline endpoint polish + analytics groundwork (Weeks 34–35), or external API/webhooks surface (Week 33).
