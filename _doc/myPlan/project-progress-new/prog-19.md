# Progress Report 19 — Sale CRM (Week 31): Offers, Counteroffers & SOLD Flow

**Date:** 2026-08-23
**Role:** Senior Solution Architect & Fullstack Engineer
**Status:** Completed — 10/10 live assertions; the full sale negotiation lifecycle works end-to-end on marketplace SALE listings

---

## Executive Overview

Delivered **Week 31 Sale CRM**: buyers submit offers on SALE listings, sellers counter/accept/reject, and acceptance atomically marks the listing **SOLD**, rejects all sibling offers, and records the decided price. Buyer identity is authenticated (central identity → marketplace account), with self-offer and duplicate-pending guards.

---

## 1. Schema (marketplace plane)

- New `SaleOffer` model + `SaleOfferStatus` enum (`PENDING/COUNTERED/ACCEPTED/REJECTED/WITHDRAWN`), FK'd to `PropertyListing` and `MarketplaceAccount`.
- Counter-offers reuse the row: seller sets `counterAmount`; buyer's accept-at-counter closes at that price.
- Provisioned via both paths: Prisma `db push` (scratch) and versioned SQL (`prisma/marketplace/sql/002_sale_offers.sql` through the existing SQL applier).

## 2. API (`/marketplace/*`, JWT-protected)

| Endpoint | Actor | Behaviour |
|---|---|---|
| `POST /listings/:id/offers` | buyer | PENDING offer on ACTIVE SALE listing; self-offer 403; duplicate pending 409 |
| `GET /listings/:id/offers` | seller | All offers w/ buyer verification state |
| `GET /offers/mine` | buyer | Own offers across listings |
| `POST /offers/:id/counter` | seller | COUNTERED + counterAmount |
| `POST /offers/:id/accept` | seller | Direct accept at offer amount |
| `POST /offers/:id/accept-counter` | buyer | Accept seller's counter at counterAmount |
| `POST /offers/:id/reject` / `/withdraw` | seller / buyer | Terminal states |

Accept (either form) runs in one transaction: winning offer ACCEPTED → sibling PENDING offers REJECTED → listing status SOLD.

## 3. Verification (live :6799)

Asking ৳3.8 Cr → buyer-1 offers ৳3.2 Cr · buyer-2 offers ৳3.4 Cr → seller counters buyer-1 at ৳3.55 Cr → buyer accepts → **listing SOLD**, sibling REJECTED, decidedAt recorded. Guards proven: self-offer 403, duplicate pending 409.

## 4. Session Notes

Recovered two files lost to a path-typo directory (`MohammadShekh` vs `Sheakh`) and repaired five build errors from partial patch application — root-caused via full `tsc --noEmit` sweep instead of grepped nest output.

## 5. Remaining Next Steps

1. Controlled document sharing wired into offers (visibility rules exist).
2. Automation engine (Week 32) over domain events.
3. Commission payout ledger + viewing tracking (Week 30 tail).

---

*Progress chain: prog-08 … prog-18 → **prog-19 (Week 31 Sale CRM)**.*
