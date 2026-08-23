# Progress Report 21 — Unit Owner Portal (Week 29): API Complete

**Date:** 2026-08-23
**Role:** Senior Solution Architect & Fullstack Engineer
**Status:** Completed — 9/9 live assertions; identity-bound unit owners get a cross-org portfolio view

---

## Executive Overview

Delivered **Week 29 Unit Owner Portal** on the API side: owners bound via `UnitOwnership.ownerCentralUserId` now have a fourth identity-bound surface (`/owner/*`) that fans out across every ACTIVE organization and reports their exact stake — expected rent by share %, co-owners, outstanding per unit, consolidated statements and maintenance visibility.

---

## 1. Design

No schema change: `UnitOwnership.ownerCentralUserId` (added in the ownership groundwork) is the binding key. `locateAll()` fans out across ACTIVE orgs collecting stakes with:

- active lease (`ACTIVE` / `NOTICE_GIVEN`) incl. renter name
- all ACTIVE ownership rows → my share + **co-owners**
- open-invoice outstanding per unit (`ISSUED/PARTIALLY_PAID/OVERDUE`)

## 2. API (`/owner/*`, JWT-protected)

| Endpoint | Returns |
|---|---|
| `GET /owner/me` | Per-unit snapshot: share %, co-owners, lease (dates/rent/status/renter), `expectedMonthlyRentBdt` = rent × share%, `outstandingBdt`; portfolio totals |
| `GET /owner/invoices[?unitId]` | Consolidated statements across owned units w/ lines + payments/receipts, newest first |
| `GET /owner/maintenance` | Tickets on any owned unit (visibility only) |

## 3. Verification (live :6799)

Setup built a real co-owned tenancy: Sultana 40% (no login) + Jalil 60% (identity-bound) · ACTIVE lease @৳50k · invoice partially paid ৳20k.

| Check | Result |
|---|---|
| Expected rent = 60% × 50k = **30,000** | ✅ |
| Co-owners surfaced to Jalil | ✅ |
| Outstanding computed per unit | ✅ |
| Consolidated statements include tenancy invoice | ✅ |
| Maintenance tickets visible for owned unit | ✅ |
| Non-owner gets clean 404 (no data leak) | ✅ |

## 4. Remaining Next Steps

1. Owner portal UI in saas-web (design-language compliant).
2. Sale CRM tail: dedicated sale-timeline endpoint.
3. Automation engine (Week 32); analytics groundwork (34–35).

---

*Progress chain: prog-08 … prog-20 → **prog-21 (Week 29 owner portal API)**.*
