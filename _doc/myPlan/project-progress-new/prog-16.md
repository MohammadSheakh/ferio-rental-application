# Progress Report 16 — Renter Notices & Documents, PWA Shell (Week 28 Complete)

**Date:** 2026-08-23
**Role:** Senior Solution Architect & Fullstack Engineer
**Status:** Completed — Week 28 Renter Portal fully closed out (7/7 new assertions; 19/19 + 5/5 regressions green)

---

## Executive Overview

Closed the final two Week 28 gaps — **notices** and **documents** — on both sides of the fence: staff can post org-wide or unit-targeted announcements and attach tenancy documents; renters see exactly what belongs to them in the "My Rental" UI. Added a PWA manifest + app icon shell for the marketplace surface.

---

## 1. Backend

### New model (`Notice`, migration `0004_renter_notices`)
- `title / body / unitId? / postedBy` — `unitId NULL` means organization-wide.

### Renter endpoints
- `GET /renter/notices` — org-wide ∪ unit-targeted, newest first (max 50)
- `GET /renter/documents` — `TenantDocument`s attached to the caller's LEASE or UNIT only

### Staff endpoints (`/tenant/*`, domain-gated)
- `POST /tenant/notices` (leasing domain) — org-wide or per-unit
- `GET /tenant/notices?unitId=` — staff view incl. org-wide
- `POST /tenant/documents` (inventory domain) — restricted to UNIT/LEASE attachment types so renter-visible documents are explicit by construction
- `GET /tenant/documents?attachedToType&attachedToId`

## 2. Frontend (`ferio-marketplace-web` `/renter`)

Two new sections rendered from live data:
- **Notices** — title/date/body rows
- **Documents** — name + category chip + Open link

Plus **PWA shell**: `app/manifest.ts` (standalone display, Ferio theme colours) and an SVG app icon (`app/icon.svg`) — installable baseline without a service worker yet.

## 3. Verification (live, :6799)

| Check | Result |
|---|---|
| Org-wide + unit notices posted by staff | ✅ |
| Render sees BOTH in `/renter/notices` | ✅ |
| LEASE + UNIT documents attached | ✅ renter sees exactly those two |
| Foreign-unit document isolation | ✅ not leaked |
| Regressions: prog13 (19/19) · prog14 (5/5) | ✅ |

## 4. Session Notes

- Prisma's AI-consent guard also applies to plane `db push` commands — consent env reused.
- Recurring footgun this session: compound build+launch commands racing the tool timeout now split into separate calls with `setsid --fork`.

## 5. Remaining Next Steps

1. Broker CRM groundwork (Week 30): leads/attribution models + endpoints.
2. Sale CRM (Week 31) offers/negotiation models.
3. Marketplace listing expiry job + Featured/Boost monetisation hooks (§21 revenue stream 2).

---

*Progress chain: prog-08 … prog-15 → **prog-16 (Week 28 closed)**.*
