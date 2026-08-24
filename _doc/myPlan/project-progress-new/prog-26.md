# Progress Report 26 — §23 Paid Listing Promotions + §24 Room-by-Room Detail

**Date:** 2026-08-23
**Role:** Senior Solution Architect & Full-Stack Developer
**Status:** Completed — 21/21 new assertions green; 8 regression suites (72 assertions) all passing

---

## Executive Summary

Delivered the two v2.2 product additions specified by the owner and folded into `prd-new.md` (§26/§27) and the checklist (§23/§24):

1. **Paid listing promotions** — advertisers pay Ferio directly for priority placement, badges and extra visibility. A brand-new Advertiser → Ferio revenue stream, kept strictly separate from rent and subscription ledgers.
2. **Rich unit detail** — room-by-room breakdown (name, type, feet×feet dimensions, description, photos) on units, carried through the outbox projection so public listings render full detail.

Plus one latent bug fixed en route.

---

## 1. §23 Paid Promotions (marketplace plane)

### Schema (SQL `003_promotions_rooms.sql`)
| Model | Purpose |
|---|---|
| `ListingPromotion` | type (`FEATURED`/`URGENT`/`TOP_SEARCH`), status (`PENDING_PAYMENT→ACTIVE→EXPIRED/CANCELLED`), amountBdt, durationDays, paidVia/reference, decidedBy |
| `PropertyListing.promotionTier / promotionBadges / promotedUntil` | denormalized ranking state recomputed after every transition |

### Pricing
Seeded catalog (BDT): FEATURED 800/1500/2800 · URGENT 500/900/1700 · TOP_SEARCH 1200/2200/4000 for 7/15/30 days — env-overridable via `PROMO_PRICE_<TYPE>_<DAYS>_BDT`.

### API
Advertiser (`PromotionController`, JWT-bound):
- `GET /marketplace/promotions/catalog` — public pricing
- `POST /marketplace/listings/:id/promotions` — own-listing order → PENDING_PAYMENT
- `GET /promotions/mine` · `GET /promotions/:id/stats` (in-window inquiry count) · cancel own PENDING

Platform (`PromotionAdminController`, RBAC SUPER_ADMIN/ADMIN/SUPPORT):
- `GET /platform/marketplace/promotions?status=` · `POST /:id/confirm-payment {paidVia, reference}` → ACTIVE · `POST /:id/cancel`
- `POST /platform/jobs/expire-promotions` (CronJobsService scan)

### Ranking & effects
- Plain search: `orderBy [promotionTier desc, chosen sort]`; geo search + map markers order/filter by tier and carry badges in payloads.
- Expiry scan flips past-window promos to EXPIRED and rebuilds each affected listing's tier/badges/until from remaining ACTIVE rows (verified: URGENT expired → badge removed, FEATURED retained).
- Moderation interlock: only ACTIVE listings promotable. Advertisers can never self-activate — confirmation is a platform-only action. Every transition writes a control-plane audit event.

## 2. §24 Room-by-Room Detail

### Tenant plane (migration `0009_unit_rooms`)
- `UnitRoom` (name, `RoomType`, lengthFt, widthFt, description, sortOrder) + `UnitRoomMedia`.
- Inventory-gated CRUD under `/tenant/units/:id/rooms`, `/tenant/unit-rooms/*` with scope-ACL assertions; room list returns computed sqft (14×12 → 168).

### Marketplace plane
- `ListingRoom` / `ListingRoomMedia` projected from tenant rooms inside the publish/update outbox payload — idempotent delete+recreate; bare repair events never wipe rooms.
- Free-advertiser listings get the same structure: `/marketplace/accounts/:accountId/listings/:id/rooms` CRUD (owner-guarded), included in public detail.
- `GET /marketplace/listings/:id` now returns `rooms[]` with media ordered.

### Verified E2E (prog26.verify.ts)
Rooms on unit → publish → projection drained → public detail shows ft×ft + photo; kitchen edited 9×8→11×9 tenant-side → update-projection → reflected publicly.

---

## 3. Bug Fixed En Route

| Bug | Impact | Fix |
|---|---|---|
| `createListing` used `account.accountType` as `sellerType` | Any **INDIVIDUAL** account posting without explicit sellerType crashed with 500 (`Invalid value for argument sellerType`) | Fall back to OWNER when accountType has no SellerType equivalent |

## 4. Regression Results (scratch :6799)

prog13 19/19 · prog14 5/5 · prog17 11/11 · prog18 4/4 · prog19 10/10 · prog20 9/9 · prog21 9/9 · prog22 5/5 — **72/72** ✅ (+ prog-26 21/21)

Environment notes: scratch PRO plan `maxUnits` bumped 50→500 (test data had exhausted quota); marketplace SQL `003` applied via applier; tenant migration `0009` applied via `migrate deploy`.

## 5. Remaining Next Steps

1. Marketplace-web UI: promotion badges on cards/map chips, room gallery on detail page, "Promote my listing" flow.
2. Homepage spotlight slot (TOP_SEARCH eligibility endpoint).
3. Promotion revenue report (platform analytics).
4. From the assessment backlog: file upload pipeline, self-serve subscribe→provision, rate limiting/anti-spam.

---

*Progress chain: … prog-25 → **prog-26 (§23 promotions + §24 room detail)**.*
