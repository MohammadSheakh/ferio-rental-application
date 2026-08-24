# Progress Report 31 — § Week 33 External API & Webhooks

**Date:** 2026-08-24
**Role:** Senior Solution Architect & Full-Stack Developer
**Status:** Completed — prog31 17/17; full regression battery **13 suites / 140 assertions** green

---

## Executive Summary

Delivered the entire Week 33 block: machine credentials for organizations (API keys with scopes + rate limits) and the official outbound webhook system (signed deliveries, retries, dead-letter, replay, delivery log).

## 1. External API (`/external/v1/*`)

### Credentials (`ApiClient`, control plane)
- Key format `fk_live_<prefix>_<secret>`; only sha256 hash stored; full key returned **once** at creation
- Platform surface: issue (`POST /platform/organizations/:id/api-keys`), list, revoke — revocation is immediate
- Scopes: `units:read · invoices:read · leases:read · maintenance:read`, enforced per route via `ApiScopesGuard`

### Read-only data plane
`GET /external/v1/{ping,units,invoices,leases,maintenance}` — each request resolves the key's org and reads **only that org's tenant DB** through the pooled connection manager. Rate limited per key (120/min default, `EXTERNAL_API_RATE_LIMIT`) with `X-RateLimit-*` headers and clean 429s.

## 2. Outbound Webhooks

### Models (migration `0012`)
`WebhookEndpoint` (url, secret, events[], enabled) · `WebhookDelivery` (event, payload, status, attempts, nextAttemptAt, responseCode, error)

### Guarantees
| Concern | Implementation |
|---|---|
| Authenticity | `X-Ferio-Signature: sha256=HMAC(secret, rawBody)` — verified against a live receiver in E2E |
| Reliability | exponential backoff (base env-tunable), dead-letter after maxAttempts |
| Replay | `POST /tenant/webhooks/deliveries/:id/redeliver` |
| Observability | delivery log with status/attempts/responseCode/error, filterable |

Owner-gated management under `/tenant/webhooks` (secret shown once; non-owner mutations 403). Background flusher polls all ACTIVE tenant DBs.

Events emitted this round: `payment.verified` (on verification transition only — idempotent re-verifies do not re-fire) and `invoice.overdue` (per newly-overdue invoice in the cron scan). More emitters are one-liners on the same `emit()` path.

## 3. Verification (prog31.verify.ts)

Key: missing → 401 · issue-once → authenticate+org binding → units read → scope-blocked leases 403 → revoke → immediate 401. Rate limit 429 within window. Webhooks: subscribe → payment verified → signed delivery received with valid HMAC → SUCCESS logged; dead port dead-lettered after configured attempts; replay re-delivered. **17/17.**

Regression battery: prog13 19 · prog14 5 · prog17 11 · prog18 4 · prog19 10 · prog20 9 · prog21 9 · prog22 5 · prog26 21 · prog27 10 · prog28 11 · prog29 14 · prog30 12 = **140/140 ✅**

Builds: ferio-nest-prisma ✅

## 4. Remaining Next Steps

1. Custom domains (W26): CNAME ownership verification + SSL workflow.
2. Gateway integrations for platform billing + promotion payments.
3. Ledger coverage widening: utility postings, commission payouts, deposits.
4. Key rotation UX + per-endpoint event catalog documentation.

---

*Progress chain: … prog-30 → **prog-31 (external API + webhooks)**.*
