# Progress Report 38 — Bangladesh Payment Gateways (bKash · SSLCommerz · aamarPay · ShurjoPay)

**Date:** 2026-08-24
**Role:** Senior Solution Architect & Full-Stack Developer
**Status:** Completed — prog38 14/14; regression spot-battery green (prog27 needs INQUIRY_RATE_LIMIT=10 for its rate-limit assertion)

---

## Executive Summary

Closed the last externally-blocked engineering item: a **Bangladesh payment-gateway layer** covering the four dominant BD providers plus a sandbox mock, wired into both online-payable money flows (platform subscription invoices + listing promotions) with exactly-once fulfillment.

## 1. Architecture (`src/infrastructure/payments/`)

Every BD gateway follows the redirect pattern: initiate → hosted page → IPN/callback → server-side verification. One abstraction, five drivers:

| Driver | Initiate | Verify | Env |
|---|---|---|---|
| `bkash` | grant token → `/tokenized/checkout/create` → bkashURL | execute / payment-status → `Completed` | BKASH_BASE, APP_KEY/SECRET, USERNAME/PASSWORD |
| `sslcommerz` | form-encoded session init → GatewayPageURL | val_id validation API + **amount echo check** | SSLCOMMERZ_STORE_ID/PASSWD/BASE |
| `aamarpay` | jsonpost.php → payment_url | transaction.php status VALID + amount | AAMARPAY_STORE_ID/SIGNATURE_KEY/BASE |
| `shurjopay` | get_token → create → checkout_url | verification API SUCCESS/amount | SHURJOPAY_USERNAME/PASSWORD/BASE |
| `mock` | internal sandbox hosted page | outcome-driven | none (always available) |

Sandbox/live selected purely by env (`*_BASE` pointing at sandbox hosts); unconfigured real drivers fail initiation with an explicit missing-env message.

## 2. PaymentIntent ledger (control plane)

Each attempt persists gateway, gatewayRef, amount, payer, status (PENDING→PAID/FAILED/CANCELLED). Fulfillment is **exactly-once** (status guard) and dispatches by context:
- `PLATFORM_INVOICE` → PlatformBilling.recordPayment(method=GATEWAY, reference=gateway:txn)
- `LISTING_PROMOTION` → PromotionService.confirmPayment(same trail)

Ownership enforced at initiation: platform invoices require the workspace ORGANIZATION_OWNER; promotions require the listing's seller account. Stale PENDING intents cancel on re-initiation.

## 3. Endpoints

```
POST /payments/intents                authed → { intentId, paymentUrl }
GET  /payments/intents/:id            status
POST /payments/callback/:gateway      public IPN (server-side verify)
GET  /payments/sandbox/:intentId      mock hosted page (dev)
POST /payments/sandbox/:intentId/confirm  success|fail|cancel decision
```

## 4. Verification (prog38)

Foreign-invoice guard 403 · initiate → hosted page · failure path → FAILED · retry → confirm → PAID → platform billing fulfilled w/ GATEWAY reference · double-confirm blocked · promotion checkout ৳800 → PAID → FEATURED active w/ promotedUntil · promotion ledger shows GATEWAY trail · cancel → FAILED · status endpoint. **14/14.**

Regression: prog29 14 · prog30 12 · prog36 10 · prog37 9 · prog13 19 · prog19 10 ✅ (prog27 rate-limit assertion needs `INQUIRY_RATE_LIMIT=10`, verified 10/10 on its env).

Ops note: scratch Postgres hit max_connections after ~70 accumulated test orgs — cleaned fleet, raised limit to 300.

Builds: ferio-nest-prisma ✅

## 5. Remaining Next Steps

Everything left is vendor/hosting-led: production gateway credentials per provider (flip env), PITR/WAL enablement, prod DNS/TLS automation, enterprise pilot onboarding. Application-side checklist is complete through Release 3's buildable scope.

---

*Progress chain: … prog-37 → **prog-38 (BD payment gateways)**.*
