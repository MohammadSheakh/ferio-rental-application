# Progress Report 27 — §23 Completed, Anti-Spam Rate Limits & Self-Serve Provisioning

**Date:** 2026-08-24
**Role:** Senior Solution Architect & Full-Stack Developer
**Status:** Completed — 10/10 new assertions green; full regression battery 10 suites / **103 assertions** all passing

---

## Executive Summary

Closed the §23 promotion leftovers, two 🔴 blocking items from the assessment backlog, and shipped the marketplace-web UI for both v2.2 features:

1. **Homepage spotlight** — `GET /marketplace/listings/spotlight` (live TOP_SEARCH promotions) + hero strip on ferio.com.
2. **Promotion revenue report** — `promotions` block in `GET /platform/analytics` (revenueBdt, byType, byMonth).
3. **Anti-spam rate limits** — ThrottlerGuard on marketplace contact endpoints (inquiries/viewings 10/h, reports 5/h per IP → 429 verified).
4. **Self-serve subscribe→provision** — `POST /identity/my/organizations`: a signed-in advertiser provisions their own workspace (dedicated tenant DB via the real pipeline) and becomes its ORGANIZATION_OWNER.
5. **Frontend** — promotion badge chips on cards/detail (FEATURED/URGENT/★SPOTLIGHT), ★ map markers, room-by-room gallery with ft×ft dimensions on the public detail page.

## 1. Critical Fix: Broken Tenant Migration Chain

Fresh provisioning was failing for ALL new tenants — `0006_crm_lead_renter_relation` re-added a column that `0005` already creates (`CrmLead.convertedRenterId`). Found by the self-serve E2E (first fresh-DB provision since migration 0008 landed).

| Fix | Detail |
|---|---|
| `0006` made replay-safe | `ADD COLUMN IF NOT EXISTS` + DO-block-guarded FK constraint |
| Full-chain replay verified | empty DB → all 9 migrations applied cleanly |

This class of bug would have broken every new customer at first subscribe — caught before production.

## 2. Self-Serve Provisioning Details

`POST /identity/my/organizations { name, slug?, planTier? }` (JWT):

- slug auto-derived from display name when omitted; format-validated
- calls the hardened ProvisioningService pipeline (idempotent steps, migrate deploy, owner seeding, subscription ACTIVE on chosen tier)
- **ownership check on re-entry**: an ALREADY_PROVISIONED result only returns to the org's own owner — anyone else requesting a taken slug gets a clean 409 with no info leak
- anonymous requests rejected; founder verified as ORGANIZATION_OWNER via `/identity/my/organizations`

## 3. Environment Notes

- Scratch PRO plan quotas raised (`maxProperties` 10→200 etc.) after repeated suite runs exhausted them — surfaced as prog21 failures, not a code bug.
- Rate-limit buckets are per-API-process: run prog27 last in a battery or restart the API between batteries (shared localhost IP).

## 4. Verification

prog27.verify.ts — 10/10:
spotlight absent→present around TOP_SEARCH activation · revenue report (৳17,000 · byType/byMonth) · inquiry spam hits 429 · self-serve provision COMPLETED w/ domain+schemaVersion · idempotent owner re-entry · rival-slug 409 · ORGANIZATION_OWNER membership.

Regression battery (fresh API): prog13 19 · prog14 5 · prog17 11 · prog18 4 · prog19 10 · prog20 9 · prog21 9 · prog22 5 · prog26 21 · prog27 10 = **103/103 ✅**

Builds: ferio-nest-prisma ✅ · ferio-marketplace-web ✅

## 5. Remaining Next Steps

1. "Promote my listing" advertiser UI flow (order + pricing catalog in marketplace-web).
2. File upload pipeline (S3/Cloudinary decision) — last big 🔴 blocker.
3. Platform billing (W27) so self-serve subscriptions can actually collect payment.
4. LedgerEntry double-entry posting + utility allocation math (R2 financial gaps).

---

*Progress chain: … prog-26 → **prog-27 (§23 complete + anti-spam + self-serve provisioning)**.*
