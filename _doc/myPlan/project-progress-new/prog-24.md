# Progress Report 24 — Automation Trigger Wiring, Missing Reports & Analytics Foundation

**Date:** 2026-08-23
**Role:** Senior Solution Architect & Full-Stack Developer
**Status:** Completed — 3 automation triggers wired live; 4 new report endpoints verified

---

## Executive Summary

Closed the three remaining automation trigger wirings (LEASE_EXPIRING, LISTING_EXPIRING, MAINTENANCE_OPENED) and added four new tenant report endpoints covering overdue renters, lease expiry, and utility/service charge collection — addressing the highest-priority gaps flagged in prog-23.

---

## 1. Automation Trigger Wiring (completes Week 32)

| Trigger | Wired Into | Fires When |
|---|---|---|
| `LEASE_EXPIRING` | `runLeaseExpiryScan()` | Per ACTIVE lease ending within 30 days |
| `LISTING_EXPIRING` | `runListingExpiryScan()` | Per org-attributed listing past `expiresAt` |
| `MAINTENANCE_OPENED` | `createMaintenanceRequest()` | After each new maintenance request is created |

**Listing expiry scan restructured**: now collects org-attributed listings first, fires automations per org, then expires unattributed listings separately. All three triggers fire via the same `evaluate()` entry point with idempotency + dry-run support.

## 2. New Report Endpoints (`/tenant/reports/*`)

| Endpoint | Returns |
|---|---|
| `GET reports/overdue-renters` | Renters w/ OVERDUE invoices: name, phone, unit, property, outstanding, due date |
| `GET reports/lease-expiry?days=N` | ACTIVE leases expiring within N days (default 90) w/ renter contact + days remaining |
| `GET reports/utility-collection` | Utility breakdown by category + total service charge collected |

## 3. Verified Live (:6799)

| Check | Result |
|---|---|
| Overdue renters report | ✅ 5 overdue invoice(s) found |
| Lease expiry report | ✅ 0 expiring within window (expected — no near-expiry leases in scratch data) |
| Utility collection report | ✅ totals returned (0 since no utility charges seeded yet) |
| Regressions prog13 19/19 · prog14 5/5 · prog17 11/11 · prog18 4/4 · prog20 9/9 · prog21 9/9 | ✅ |

## 4. Remaining Next Steps

1. Owner portal UI polish (design-language compliance review).
2. Sale CRM timeline endpoint UI.
3. Analytics groundwork (Weeks 34–35): marketplace listing volume, area demand, inquiry conversion.
4. External API surface (Week 33).

---

*Progress chain: prog-08 … prog-23 → **prog-24 (trigger wiring + analytics foundation)**.*
