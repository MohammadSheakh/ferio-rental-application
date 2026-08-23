# Progress Report 14 — Renter Portal Complete: Utilities, Maintenance & Live UI

**Date:** 2026-08-23
**Role:** Senior Solution Architect & Fullstack Engineer
**Status:** Completed — Renter Portal is now end-to-end (API + UI), verified live; regression suite still 19/19

---

## Executive Overview

Finished the **Week 28 Renter Portal**: added the remaining backend surfaces (utilities with meter readings, unit-scoped maintenance tickets) and shipped a complete **"My Rental" UI inside ferio.com** — the marketplace surface renters already use, per PRD §19's "don't fragment unnecessarily yet".

---

## 1. Backend — Renter Portal additions (`/renter/*`)

| Endpoint | Behaviour |
|---|---|
| `GET /renter/utilities` | Utility accounts for the rented unit incl. meters + 3 latest readings each |
| `GET /renter/maintenance` | Tickets for the rented unit, newest first, with work-order status |
| `POST /renter/maintenance` | Renter opens a UNIT-scoped ticket (`OPEN`) — audited as `maintenance.renter_reported` |

**Correctness fix discovered by verification:** tenancy resolution previously anchored on an arbitrary `Renter.findFirst`, which broke when duplicate identity-bound rows existed. Rewrote `locate()` to anchor on the **ACTIVE lease first** (`lease.findFirst({ where: { status in [ACTIVE, NOTICE_GIVEN], renter: { centralUserId } } })`). `createRenter` now also dedupes: re-inviting an existing tenant updates their row instead of duplicating it.

## 2. Frontend — "My Rental" in `ferio-marketplace-web`

New `/renter` page (design-language compliant throughout):

- **Auth gate**: anonymous → sign-in prompt; no active tenancy → calm empty state ("Once a landlord confirms your tenancy in Ferio, it appears here").
- **Tenancy header**: property · unit · lease window · status pill · monthly rent · outstanding (semantic rose/emerald).
- **How to pay**: per-beneficiary instructions from real ownership shares (bKash/Nagad/bank numbers).
- **Statements table**: period, totals, due date, receipt numbers, status pills + Report-Payment modal → verification queue.
- **Maintenance**: ticket list (status/assignment/cost) + Report-an-issue modal (title/urgency/details).
- **Utilities & meters**: per-account latest reading with consumption.
- Header gains a "My Rental" link when signed in.

## 3. Backend gap closed

Exposed missing **`POST /tenant/utilities/meters`** route (service existed, unexposed) with inventory-domain guard.

## 4. Verification

| Suite | Result |
|---|---|
| `test/prog14.verify.ts` — self-contained tenancy → DESCO meter+reading visible to renter → renter opens UNIT ticket → management queue sees it | ✅ 5/5 |
| `test/prog13.verify.ts` (regression) | ✅ 19/19 |
| `ferio-marketplace-web` production build | ✅ |

## 5. Remaining Next Steps

1. Admin-web TOTP second-step login UX + QR rendering.
2. Per-resource scope-array ACLs (property/building/unit) beyond role gates.
3. Documents & notices models for the renter surface; PWA manifest/offline shell.
4. Broker CRM (Week 30) groundwork.

---

*Progress chain: prog-08 … prog-12 → prog-13 (identity/TOTP/RBAC) → **prog-14 (renter portal complete)**.*
