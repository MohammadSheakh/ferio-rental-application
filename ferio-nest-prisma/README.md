# Ferio Commerce API

NestJS 11 + PostgreSQL + Prisma backend for the Ferio customer storefront and
operations dashboard.

## Current Release 0 scope

- Modular NestJS workspace with shared `common`, `database`, `redis`, `queue`,
  and `notification` libraries
- PostgreSQL access through Prisma 7
- Email/password authentication with access and rotating refresh tokens
- Redis-backed OTP, token revocation, caching, and rate limiting
- Dedicated admin login with server-side role enforcement
- User/profile and settings foundations
- Category, product, variant, and SKU management
- One-warehouse inventory with immutable stock movements
- Persistent guest carts with server-side price and availability revalidation
- Durable, idempotent, privacy-safe storefront commerce analytics events
- Customer/address models, configurable delivery zones, and persisted checkout previews
- Idempotent COD orders with immutable snapshots and confirmation-time reservations
- Provider-neutral shipping with configuration-gated Pathao and Steadfast adapters
- Swagger, validation, security headers, compression, structured responses,
  and health endpoint

The payment, subscription, chat, socket, notification, and attachment folders
are reference/migration work and are not part of the active Ferio application
module yet.

## Catalog API

- Public: `GET /api/v1/catalog/categories`
- Public: `GET /api/v1/catalog/products`
- Public: `GET /api/v1/catalog/products/:slug`
- Admin: `GET|POST /api/v1/admin/catalog/categories`
- Admin: `PATCH /api/v1/admin/catalog/categories/:id`
- Admin: `GET|POST /api/v1/admin/catalog/products`
- Admin: `PATCH /api/v1/admin/catalog/products/:id`
- Admin: `PATCH /api/v1/admin/catalog/products/:id/status`
- Admin: `GET /api/v1/admin/catalog/inventory`
- Admin: `PATCH /api/v1/admin/catalog/inventory/:variantId`
- Admin: `GET /api/v1/admin/catalog/inventory/:variantId/movements`

Catalog prices use integer minor units. For BDT, `145000` represents
`৳1,450.00`. Inventory is tracked by SKU and warehouse, and every initial or
manual stock change creates a movement record.

## Cart API

- Public: `GET /api/v1/cart`
- Public: `POST /api/v1/cart/items`
- Public: `PATCH /api/v1/cart/items/:variantId`
- Public: `DELETE /api/v1/cart/items/:variantId`
- Public: `POST /api/v1/cart/validate`

Guest cart tokens are opaque, stored as SHA-256 hashes in PostgreSQL, and kept
in an HTTP-only Customer Web cookie. Cart totals are estimates. The backend
rechecks publication, current price, variant state, quantity, and available
stock without reserving inventory before the approved checkout policy applies.

## Storefront Analytics API

- Public: `POST /api/v1/storefront-analytics/events`

The versioned event contract accepts product-view, search, filter, and
add-to-cart events. It uses server timestamps, validates active catalog
references, allowlists filter fields, redacts likely contact details from search
terms, and stores only an HMAC-pseudonymous visitor identifier. IP addresses,
user-agent strings, referrers, and URL query strings are not persisted. Set a
dedicated `ANALYTICS_HASH_SECRET` in production; the access-token secret is only
the compatibility fallback.

## Checkout API

- Public: `GET /api/v1/checkout/delivery-options`
- Public: `POST /api/v1/checkout/preview`
- Admin: `GET /api/v1/admin/delivery-zones`
- Admin: `POST /api/v1/admin/delivery-zones`
- Admin: `PATCH /api/v1/admin/delivery-zones/:id`

Checkout preview normalizes Bangladesh mobile numbers, revalidates every cart
line, checks COD eligibility, applies the configured district fee or free-delivery
threshold, and persists a 24-hour cart-linked draft.

## Order API

- Public: `POST /api/v1/checkout/orders` with `Idempotency-Key`
- Admin: `GET /api/v1/admin/orders`
- Admin: `GET /api/v1/admin/orders/:id`
- Admin: `POST /api/v1/admin/orders/:id/confirm`
- Admin: `POST /api/v1/admin/orders/:id/cancel`
- Admin: `GET|PATCH /api/v1/admin/orders/cod-policy`

Order conversion creates immutable customer-address and item snapshots, links or
creates a commerce customer, and stores independent lifecycle states. COD orders
awaiting verification reserve no stock. Confirmation reserves stock in a
serializable transaction; cancellation requires a reason and releases active
reservations in the same transaction.

## Shipping API

- Admin: `GET /api/v1/admin/shipping/providers`
- Admin: `PATCH /api/v1/admin/shipping/providers/:code`
- Admin: `GET /api/v1/admin/shipping/shipments`
- Admin: `GET|POST /api/v1/admin/shipping/orders/:orderId`
- Provider webhook: `POST /api/v1/webhooks/couriers/:provider`

Shipping data remains separate from orders through `ShipmentProvider`,
`Shipment`, `ShipmentEvent`, and `ShipmentWebhookLog`. Provider secrets stay in
environment or secret management and are redacted from webhook logs. A provider
cannot be activated without its required credentials. Webhooks are authenticated,
deduplicated, retained raw, normalized, and checked against explicit transition
rules before changing shipment state.

Pathao shipment creation additionally requires merchant store and recipient
city/zone/area IDs. Steadfast shipment creation uses the immutable order address.
Real provider credentials and sandbox callback tests are required before either
adapter is production-ready.

## Reports API

- Admin: `GET /api/v1/admin/reports/overview`
- Admin: `GET /api/v1/admin/reports/orders-export`

Order CSV exports require `reports.read`, are limited to 5,000 filtered rows,
and create an append-only audit record. Actors without `customers.read` receive
masked recipient names and phone numbers plus a suppressed area value. Email,
detailed address, landmark, and coordinates are never exported. CSV cells are
quoted and formula-safe for spreadsheet use.

## Staged rollout controls

Audited Commerce Settings flags control prepaid checkout, purchase-activity
surfaces, service booking, new warranty submissions, and durable storefront
analytics. Service and warranty pauses are enforced by the Backend rather than
navigation alone. Existing booking and warranty records remain available to
authorized staff while new customer submissions are paused. Analytics pause
requests are acknowledged without persistence so storefront behavior is not
blocked. Apply migration `20260821233000_staged_feature_flags` before using the
new controls.

## Payment-state control

The active Admin payment API does not expose a generic manual payment-status
mutation. Admin payment operations are limited to read access and authorized
expiry-recovery orchestration. Order payment state changes are evidence-bound:
validated provider callbacks, system expiry recovery, courier settlement, or
refund outcomes. Provider and expiry transitions write append-only audit records
inside the same serializable transaction as the affected state; settlement and
refund workflows retain their existing audited evidence.

The protected payment ledger supports paginated provider, attempt-status,
order-payment-status, refund-status, and transaction/order reference filters at
`GET /api/v1/admin/payments/attempts`. A safe detail view is available at
`GET /api/v1/admin/payments/attempts/:id`; it includes callback metadata and
refund-ledger evidence but intentionally excludes raw callback payloads,
initiation request/response bodies, validated provider responses, redirect URLs,
and callback deduplication hashes.

## Local setup

1. Copy `.env.example` to `.env` and provide real secrets.
2. Start PostgreSQL and Redis.
3. Install dependencies with `pnpm install`.
4. Build the composed Prisma schema and client:

```bash
pnpm run prisma:sync
```

5. Apply the database migration appropriate for the environment.
6. Seed the first admin after setting `ADMIN_EMAIL` and `ADMIN_PASSWORD`:

```bash
pnpm run prisma:seed
```

7. Start the API:

```bash
pnpm start:dev
```

- Default API URL: `http://localhost:6733/api/v1`
- Swagger: `http://localhost:6733/api/docs`
- Health: `http://localhost:6733/api/v1/health`

## Validation

```bash
pnpm run prisma:sync
pnpm build
pnpm test
```

PostgreSQL integration tests require an isolated database URL whose database
name contains `_test_`, starts with `test_`, or ends with `_test`. The guard
rejects normal development and production database names.

```bash
TEST_DATABASE_URL=postgresql://.../ferio_reconciliation_test_local \
  pnpm run test:integration
```

The BullMQ runtime smoke test requires a disposable Redis instance on a
non-default port and an isolated prefix. BullMQ 5 requires Redis 6.2 or newer
for supported production and staging operation.

```bash
TEST_REDIS_PORT=6389 TEST_QUEUE_PREFIX=ferio:test:reconciliation \
  pnpm run test:queue-smoke
```

## Architecture rule

Ferio begins as a modular monolith. Shared technical capabilities live in
workspace libraries; business modules remain under `src/features`. New
infrastructure or separately deployed services require a measured product or
operational need defined by the PRD.
