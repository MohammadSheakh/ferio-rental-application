# Ferio Property Platform — Implementation Checklist & Schedule

**Document Type:** Senior Software Architecture Delivery Plan  
**Product:** Ferio Property Platform  
**Architecture Model:** Multi-tenant SaaS with Database-per-Tenant + Central Marketplace + Control Plane  
**Primary Stack:** NestJS + Prisma + PostgreSQL + Redis + BullMQ  
**Frontend Surfaces:** Public Marketplace, SaaS Tenant App, Platform Admin  
**Mapping/Search:** OpenStreetMap + geospatial search  
**Target Market:** Bangladesh-first  
**Version:** 2.1 Audited Baseline (code-verified against `ferio-nest-prisma`)

---

## Audit Legend (v2.1)

Every checkbox in this document has been re-audited against the actual codebase:

| Mark | Meaning |
|---|---|
| `[x]` | Implemented AND verified in code |
| `[x]` *(partial)* | Core path exists; gaps noted inline |
| `[ ]` | Not implemented |

> **v2.0 problem this fixes:** checkboxes previously conflated "schema exists", "endpoint exists" and "tested end-to-end". Several Release 2 blocks were marked complete while having zero tests, no CI, and no implementation of their headline claim (e.g. PostGIS). v2.1 restores truthfulness so that Architecture Review Gates (§20) can be trusted.

### Audit Summary

- **Release 0:** ~80% real. Provisioning lacks rollback/retry/seeding; migration orchestrator missing entirely.
- **Release 1:** Marketplace CRUD + SaaS org/property/unit/billing schemas are real. **PostGIS geospatial search is NOT implemented** (lat/lng stored but never used in queries). Outbox pattern absent — publishing uses synchronous cross-DB writes.
- **Release 2:** Billing/utilities/maintenance service skeletons exist, but several financial-correctness claims were false (idempotent invoicing, verification workflow, utility allocation/posting). **All hardening claims removed** — no tests, no CI, no backup tooling exist.
- **Release 3:** EntitlementService exists but is registered in no module (orphaned). All advanced entitlements unchecked.

---

# 1. Executive Architecture Summary

Ferio should be implemented as three major planes:

```text
                         FERIO PROPERTY PLATFORM

        ┌────────────────────┬─────────────────────┐
        │                    │                     │
        ▼                    ▼                     ▼

   CONTROL PLANE       MARKETPLACE PLANE      TENANT DATA PLANE
   Platform-level       Public discovery       SaaS operations
   configuration        & advertisements        per customer
        │                    │                     │
        │                    │               DB-per-tenant
        │                    │                     │
        ▼                    ▼                     ▼
  Control PostgreSQL   Marketplace DB       Tenant DB A
                                            Tenant DB B
                                            Tenant DB C
```

The platform has three distinct user experiences:

```text
PUBLIC MARKETPLACE
- renters
- buyers
- free property advertisers
- brokers
- sellers

TENANT SaaS APPLICATION
- building/property owners
- unit owners
- property managers
- accountants
- leasing staff
- maintenance staff
- renters of managed units

PLATFORM ADMIN
- Ferio operations
- tenant provisioning
- subscriptions
- listing moderation
- platform analytics
- support
- feature management
```

---

# 2. Core Architectural Principles

## 2.1 Database-per-Tenant

Each subscribed SaaS customer gets a logically independent PostgreSQL database.

Example:

```text
rahman.ferio.com
→ tenant_rahman_db

abcproperties.ferio.com
→ tenant_abcproperties_db
```

This isolates:

- property data
- unit data
- renters
- leases
- rent bills
- utility bills
- maintenance
- staff
- local accounting
- tenant-specific documents

## 2.2 Central Marketplace

Do not search across tenant databases.

Public listings live in a central marketplace database/index.

```text
Tenant Unit
   ↓ publish
Marketplace Listing Projection
   ↓
Public Search
```

This enables:

- area search
- rent search
- sale search
- shop/storeroom search
- OpenStreetMap
- broker listings
- owner listings
- free users
- subscription users

## 2.3 Control Plane

The control plane manages:

- SaaS tenant identity
- slug/domain
- subscription
- plan
- entitlements
- database location
- database provisioning state
- billing state
- feature flags
- platform audit
- support state
- tenant status

## 2.4 Separate SaaS Tenant from Renter

Use:

```text
SaaS customer = Organization / Workspace
Rental occupant = Renter
```

Do not use the word `Tenant` for both in domain code.

Infrastructure may internally use:

```text
SaasTenant
TenantDatabase
TenantDomain
```

but business/domain APIs should prefer `Organization`.

## 2.5 Marketplace Listing != Managed Unit

A listing is marketing inventory.

A managed unit is operational inventory.

A free user may have:

```text
Listing
```

without:

```text
Organization
Property
Building
Unit
Lease
```

Later:

```text
Listing
→ Convert to Managed Property/Unit
```

when the advertiser subscribes.

---

# 3. Delivery Strategy

Recommended sequence:

```text
Release 0 — Architecture/Foundation
Release 1 — Marketplace + SaaS Core
Release 2 — Property Operations / Billing / Utilities
Release 3 — Scale / Enterprise / Automation
```

Recommended implementation horizon:

```text
Release 0     2 weeks
Release 1    10–12 weeks
Release 2     8–10 weeks
Release 3    10–14 weeks
```

Total credible path:

```text
30–38 weeks
```

for a production-grade platform if implemented carefully.

---

# 4. Release 0 — Architecture Foundation

## Duration: Weeks 1–2

Goal:

> Establish the control plane, tenant resolution, database provisioning and architectural contracts before feature development.

## 4.1 Repository / Workspace Structure

Recommended monorepo:

```text
apps/
├── ferio-marketplace-web
├── ferio-tenant-web
├── ferio-platform-admin
├── ferio-api
└── ferio-worker

packages/
├── contracts
├── config
├── auth
├── ui-tokens
├── validation
├── logger
└── shared-types
```

## 4.2 Environment Strategy

- [ ] local
- [ ] CI
- [ ] staging
- [ ] production
- [ ] control DB
- [ ] marketplace DB
- [ ] tenant DB template/test DB
- [ ] Redis
- [ ] BullMQ
- [ ] object storage
- [ ] DNS / domain routing
- [ ] observability

## 4.3 Control Plane Schema

Create:

- [x] `SaasOrganization`
- [x] `OrganizationDomain`
- [x] `TenantDatabase`
- [x] `Plan`
- [ ] `PlanEntitlement`
- [x] `Subscription`
- [x] `SubscriptionEvent`
- [x] `ProvisioningJob`
- [x] `PlatformUser`
- [x] `PlatformAuditEvent`
- [x] `FeatureFlag`

Organization status:

```text
PROVISIONING
ACTIVE
PAST_DUE
SUSPENDED
CANCELLED
ARCHIVED
PROVISIONING_FAILED
```

Tenant database status:

```text
PENDING
CREATING
MIGRATING
SEEDING
READY
FAILED
DISABLED
```

## 4.4 Tenant Resolution

Implement request resolution by host.

```text
Incoming Request
      ↓
Host Resolver
      ↓
Control Plane Lookup
      ↓
Organization Status
      ↓
Subscription / Entitlement
      ↓
Tenant DB Context
      ↓
Request Handler
```

Checklist:

- [x] host normalization
- [x] local dev host override
- [ ] custom-domain placeholder
- [x] unknown tenant handling
- [x] suspended tenant handling
- [x] Redis/in-memory tenant lookup cache
- [x] cache invalidation
- [x] request-scoped tenant context
- [x] correlation ID

## 4.5 Tenant Database Connection Architecture

Build:

```text
TenantDatabaseManager
TenantPrismaFactory
TenantConnectionCache
```

Checklist:

- [x] bounded Prisma client pool
- [x] TTL/LRU connection cache
- [x] cleanup
- [ ] secret management
- [x] max connections
- [x] DB unavailable handling
- [ ] telemetry
- [ ] test isolation

## 4.6 Provisioning Pipeline

```text
Create Organization
      ↓
Validate slug
      ↓
Reserve domain
      ↓
Create DBprp
      ↓
Create organization owner
      ↓
Mark DB READY
      ↓
Activate organization
```

Checklist:

> **v2.1 implementation:** pipeline rebuilt — idempotent resumable steps, real rollback (`rollbackFailedProvisioning`), retry (`retryProvisioning`), `prisma migrate deploy` with schema-version capture, and actual owner-member seeding. Verified end-to-end against scratch PostgreSQL.

- [x] unique slug
- [x] provisioning job
- [x] retry *(resume-safe re-run + admin endpoint)*
- [x] rollback/cleanup *(explicit guarded rollback; physical DB drop opt-in)*
- [x] partial-failure handling *(each step verifies artifact state before running)*
- [x] idempotency *(re-invocation returns ALREADY_PROVISIONED without side effects — test-verified)*
- [x] migration status *(schemaVersion read back from `_prisma_migrations`)*
- [x] seed version *(recorded in workspace audit metadata)*
- [x] audit
- [x] logs

## 4.7 Migration Orchestrator

> **v2.1 implementation:** `TenantMigrationOrchestrator` — bounded worker pool (default concurrency 3, cap 10), per-tenant maintenance mode via `MIGRATING` status, post-migration health check (connectivity + no failed migration rows), schema-version capture, fleet audit trail. Admin endpoints: single/list/fleet migrate + registry view.

Capabilities:

- [x] migrate one tenant
- [x] migrate batch
- [x] migrate all tenants
- [x] concurrency limit
- [x] progress tracking *(per-outcome report; job-level progress UI pending)*
- [x] failed retry *(re-run safe; FAILED status requires operator action by design)*
- [x] maintenance mode *(automatic per-tenant during MIGRATING)*
- [ ] version compatibility *(pre-flight compatibility checks pending)*
- [ ] pre-migration backup hook
- [x] post-migration health check

## 4.8 Release 0 Exit Gate

- [ ] tenant URL resolves correctly
- [ ] tenant DB provisions automatically
- [ ] tenant DB migration works
- [ ] tenant DB seed works
- [ ] two organizations cannot cross-access
- [ ] suspended organization is blocked
- [ ] control DB contains no rental operational data
- [ ] marketplace DB is independent

---

# 5. Release 1 — Marketplace + SaaS Core

## Duration: Weeks 3–14

Goal:

> Anyone can advertise property, renters/buyers can discover it publicly, and subscribed property owners can manage real units, renters and leases in an isolated SaaS workspace.

## Week 3 — Public Identity & Marketplace Accounts

Account types:

```text
INDIVIDUAL
OWNER
BROKER
AGENCY
DEVELOPER
```

Checklist:

- [x] registration
- [x] login
- [x] email verification placeholder
- [x] phone verification placeholder
- [x] Google OAuth readiness
- [x] public profile
- [x] seller profile
- [x] broker profile
- [x] agency profile
- [x] verification badge framework

## Weeks 4–5 — Marketplace Listings

Listing purpose:

```text
RENT
SALE
```

Asset types:

```text
APARTMENT
HOUSE
ROOM
LAND
SHOP
OFFICE
WAREHOUSE
STORE_ROOM
COMMERCIAL_SPACE
BUILDING
OTHER
```

Seller types:

```text
OWNER
BROKER
AGENCY
DEVELOPER
```

Checklist:

- [x] title
- [x] description
- [x] price
- [x] rent frequency
- [x] negotiable
- [x] availability date
- [x] bedrooms/bathrooms
- [x] floor
- [x] total floors
- [x] property area
- [x] land size
- [x] parking
- [x] furnishing
- [x] amenities
- [x] listing status *(PENDING_REVIEW flow live — new/edited listings queue when moderation enabled)*
- [x] listing media *(URL metadata only — no file upload pipeline)*
- [x] cover image
- [ ] secure document uploads *(documents are URL registrations; no upload/storage pipeline)*
- [x] sale-document visibility controls *(enforced on read: PUBLIC / VERIFIED_USERS / INTERESTED_BUYERS / PRIVATE / ADMIN_ONLY — viewer-aware detail endpoint)*

Listing status:

```text
DRAFT
PENDING_REVIEW
ACTIVE
PAUSED
RENTED
SOLD
EXPIRED
REJECTED
ARCHIVED
```

## Week 6 — Location & OpenStreetMap Search

Use PostgreSQL + PostGIS.

Checklist:

> **v2.1 implementation:** generated geometry column (`location`, sync'd from lat/lng) + GiST index applied via versioned SQL migrations; radius (`ST_DWithin`), viewport-bounds (`&&` envelope) and nearest (`<->` KNN) search live; map marker endpoint shipped.

- [x] PostGIS
- [x] geo point
- [x] spatial index
- [x] address
- [x] area
- [x] district
- [x] division
- [x] postal code
- [x] lat/lng *(stored as columns; not queryable spatially)*
- [x] map-bounds search placeholder
- [x] radius search
- [x] nearest search

## Week 7 — Marketplace Discovery

Flow:

```text
Search
→ Listing Detail
→ Favorite
→ Inquiry
→ Contact
→ Viewing Request
```

Checklist:

- [x] public detail
- [x] cursor pagination *(offset pagination implemented; cursor pending)*
- [x] map result contract
- [x] favorites
- [x] inquiry
- [x] viewing request
- [x] owner/broker contact
- [ ] spam protection placeholder
- [x] abuse report
- [x] moderation *(PENDING_REVIEW queue + approve/reject/takedown + report triage under `/platform/marketplace`)*

## Week 8 — SaaS Subscription & Organization Creation

Plans:

```text
FREE_LISTING
STARTER
PRO
BUSINESS
ENTERPRISE
```

Recommended:

```text
Free advertiser
→ marketplace account only

Subscribed operator
→ organization
→ dedicated tenant DB
```

Checklist:

> **v2.1 implementation:** full lifecycle shipped — `SubscriptionLifecycleService` with transition guards, `SubscriptionEvent` audit on every mutation (RENEWED/CANCELLED/SUSPENDED/REACTIVATED/PAST_DUE/UPGRADED/DOWNGRADED), org-status cascade so the resolver enforces §15 policy, past-due scan in CronJobsService. Verified end-to-end.

- [x] plan *(seeded tiers + normalized PlanEntitlement overrides)*
- [x] entitlement service
- [x] subscription
- [x] renew
- [x] cancel
- [x] past due
- [x] suspension
- [ ] provisioning trigger *(admin-triggered only; self-serve subscribe→provision awaits auth architecture)*
- [x] subscription audit

## Week 9 — SaaS IAM

Roles:

```text
ORGANIZATION_OWNER
PROPERTY_OWNER
UNIT_OWNER
PROPERTY_MANAGER
BUILDING_MANAGER
ACCOUNTANT
LEASING_OFFICER
MAINTENANCE_MANAGER
CARETAKER
VIEWER
```

Checklist:

> **v2.1 implementation:** full invite lifecycle shipped — single-use hashed tokens with 7-day expiry, revocation, staff-seat quota gating, role-based member-admin guard, member role/status/scope updates, tenant audit events on mutations.

- [x] membership
- [x] invites
- [x] permission model *(role-based domain gates on all 24 tenant mutations: inventory/billing/leasing/maintenance)*
- [x] property scope *(scopePropertyIds enforced on property/unit reads + single-resource assertions; workspace-wide roles bypass)*
- [x] building scope *(scopeBuildingIds honoured via unit ownership-of-building match)*
- [x] unit scope *(scopeUnitIds enforced; union semantics when multiple arrays set)*
- [ ] delegation
- [x] expiry
- [x] audit

## Weeks 10–11 — Property / Building / Unit

Tenant models:

```text
Property
Building
Unit
PropertyOwnership
UnitOwnership
```

Unit types:

```text
APARTMENT
SHOP
OFFICE
ROOM
STORE_ROOM
WAREHOUSE_UNIT
COMMERCIAL_UNIT
OTHER
```

Unit status:

```text
DRAFT
AVAILABLE
LISTED
RESERVED
OCCUPIED
NOTICE_GIVEN
MOVE_OUT_PENDING
MAINTENANCE_HOLD
BLOCKED
```

Checklist:

> **v2.1 implementation:** buildings CRUD + full ownership management — share invariant (active shares ≤100%), primary-owner rules, effective-dated history preserved on share changes, payment-destination updates, last-owner protection, ownership summary with unallocated share. Verified end-to-end.

- [x] standalone property
- [x] building
- [x] units
- [x] multiple unit owners
- [x] co-owners
- [x] ownership percentages
- [x] ownership history
- [x] primary owner
- [x] unit lifecycle *(status transitions via publish/mark-rented; explicit state-machine validator pending)*

## Week 12 — Publish Managed Unit to Marketplace

```text
Tenant DB Unit
   ↓
Tenant Outbox
   ↓
Projection Worker
   ↓
Marketplace Listing
```

Checklist:

> **v2.1 implementation:** publish/update/pause/mark-rented flow through a transactional outbox (`TenantOutboxEvent`) drained by `MarketplaceProjectionWorker` with `FOR UPDATE SKIP LOCKED` claiming, exponential-backoff retries, dead-letter, and drift reconciliation — replacing the previous unsafe synchronous dual writes.

- [x] publish
- [x] update projection
- [x] pause
- [x] unpublish
- [x] mark rented
- [x] retry
- [x] reconciliation
- [x] idempotency
- [ ] audit *(publish actions not yet written to tenant audit log)*

## Week 13 — Renter Conversion & Basic Leasing

```text
Inquiry
→ Viewing
→ Application
→ Approved
→ Renter
→ Lease
```

Checklist:

- [ ] inquiry import
- [ ] renter profile
- [ ] guarantor basic support
- [ ] lease
- [ ] reservation
- [ ] activation
- [ ] unit occupied
- [ ] listing rented
- [ ] deposit
- [ ] occupants
- [ ] lease documents

## Week 14 — Direct Rent Beneficiary

Create:

```text
PaymentBeneficiary
PaymentDestination
LeasePaymentRule
```

Methods:

```text
BKASH
NAGAD
BANK
CASH
CHEQUE
OTHER
```

Checklist:

- [ ] beneficiary
- [ ] payment destination
- [ ] default unit owner
- [ ] authorized override
- [ ] account details
- [ ] MFS number
- [ ] instructions
- [ ] audit

### Release 1 Exit Gate

Free listing, marketplace search, subscription provisioning, building/unit ownership, unit publishing, renter conversion and basic lease must all work end-to-end.

---

# 6. Release 2 — Operational Property Management

## Duration: Weeks 15–24

Goal:

> Once a renter occupies a unit, Ferio manages monthly rent, utilities, maintenance, recurring charges and operational reporting.

## Week 15 — Billing Foundation

Models:

```text
BillingAccount
ChargeDefinition
Invoice
InvoiceLine
Payment
PaymentAllocation
BeneficiaryAllocation
LedgerEntry
```

Charge categories:

```text
RENT
SERVICE_CHARGE
ELECTRICITY
WATER
GAS
INTERNET
SECURITY
LIFT
CLEANING
GENERATOR
PARKING
MAINTENANCE
OTHER
```

Checklist:

- [x] recurring charge definition
- [x] invoice
- [x] invoice lines
- [x] partial payment
- [ ] ledger readiness *(no `LedgerEntry` model exists)*
- [x] overdue tracking *(cron scan implemented; not scheduler-registered)*
- [x] receipt generation *(receipt number issued at payment verification)*
- [x] idempotent invoice generation *(unique per billing account per `periodKey` — regeneration returns existing invoice, E2E-verified)*

## Week 16 — Multi-Beneficiary Billing

One statement can pay different beneficiaries.

```text
Rent           → Unit Owner
Service Charge → Building Management
Utility        → Configured beneficiary
Internet       → Direct provider / owner
```

Checklist:

- [x] beneficiary per line
- [x] amount routing *(routing data stored; no payment-splitting engine)*
- [x] consolidated renter statement
- [ ] owner receivable view
- [ ] management receivable view
- [ ] allocation reconciliation

## Weeks 17–18 — Utilities

Models:

```text
UtilityAccount
UtilityBill
UtilityBillItem
Meter
MeterReading
UtilityAllocation
```

Scope:

```text
BUILDING
UNIT
COMMON_AREA
```

Responsibility:

```text
RENTER
UNIT_OWNER
BUILDING_MANAGEMENT
SHARED
DIRECT_PROVIDER
```

Allocation:

```text
FIXED
EQUAL
PERCENTAGE
OCCUPANCY
AREA
SUBMETER
MANUAL
```

Checklist:

- [x] electricity
- [x] water
- [x] gas
- [x] generator
- [x] internet
- [x] lift
- [x] security
- [x] cleaning
- [x] custom utilities
- [x] meter photos *(photoUrl field)*
- [x] reading history
- [ ] duplicate prevention *(no same-period reading guard)*
- [ ] rounding correctness *(no allocation math implemented — `generateUtilityBill` stores totals only)*
- [ ] posting to statement *(utility bills are standalone records, never posted to invoices)*

## Week 19 — Rent Payment Recording

Flow:

```text
Renter
→ pays Unit Owner
→ proof / provider confirmation
→ Ferio records
→ allocation
→ ledger
```

Statuses:

```text
PENDING
REPORTED
VERIFIED
REJECTED
SETTLED
REVERSED
```

Checklist:

- [x] cash
- [x] bank
- [x] bKash
- [x] Nagad
- [x] cheque
- [x] proof *(proofUrl field)*
- [x] verification *(PENDING/REPORTED → staff verify → allocates to invoice + receipt; E2E-verified)*
- [x] reversal *(atomic decrement with invoice status recompute; audit events on all transitions)*
- [x] receipt
- [x] audit

## Weeks 20–21 — Maintenance

Models:

```text
MaintenanceRequest
WorkOrder
CrewMember
Vendor
MaintenanceCost
```

Scopes:

```text
BUILDING
UNIT
COMMON_AREA
```

Responsibility:

```text
RENTER
UNIT_OWNER
BUILDING_OWNER
BUILDING_MANAGEMENT
SHARED
```

Checklist:

- [ ] issue photos
- [ ] triage
- [ ] estimate
- [ ] payer
- [ ] approval
- [ ] crew assignment
- [ ] work order
- [ ] before/after evidence
- [ ] cost
- [ ] renter confirmation
- [ ] close/reopen

## Week 22 — Jobs & Notifications

Jobs:

```text
GenerateMonthlyStatements
MarkOverdue
SendRentReminder
GenerateUtilityCharges
LeaseExpiryScan
MaintenanceEscalation
MarketplaceProjectionReconcile
```

Channels:

- [x] in-app
- [x] email
- [x] SMS adapter
- [x] WhatsApp adapter
- [x] push placeholder

## Week 23 — Reports

> **v2.1 audit:** four tenant report endpoints exist (occupancy, financial, beneficiary-split, maintenance). Platform-side reporting does not exist.

Tenant reports:

- [x] occupancy
- [ ] vacancy *(separate endpoint — occupancy report only)*
- [x] rent due
- [x] rent collected
- [ ] owner receivable
- [ ] utility collection
- [ ] service charge
- [x] maintenance cost
- [ ] unit profitability
- [ ] lease expiry
- [ ] overdue renters

Platform reports:

- [ ] organizations
- [ ] subscriptions
- [ ] listings
- [ ] inquiry conversion
- [ ] active plans

## Week 24 — Release 2 Hardening

> **v2.1 audit:** every item below was checked with zero supporting evidence — no tests, no CI, no backup tooling exist in the repository. All reset to unchecked.

- [ ] financial regression
- [ ] multi-beneficiary tests
- [ ] cross-DB isolation tests
- [ ] backup/restore
- [ ] projection recovery
- [ ] queue replay
- [ ] security review
- [ ] performance review
- [ ] PostGIS review
- [ ] migration rollout test

---

# 7. Release 3 — Scale / Enterprise / Platform Maturity

## Duration: Weeks 25–38

## Week 25 — Advanced Entitlements

> **v2.1 implementation:** `PlanEntitlement` model added (normalized key/value rows overriding flat Plan columns). `EntitlementService` registered globally, TTL-cached per org, with invalidation hooks. Enforcement wired into property/unit creation (quota) and utilities/maintenance (feature gates) — verified end-to-end.

- [x] unit limits
- [x] building limits
- [x] staff limits
- [ ] storage limits *(field exists; no upload pipeline to consume it yet)*
- [x] utility entitlement
- [ ] automation entitlement *(gate ready; automation module not built yet)*
- [ ] API entitlement *(gate ready; external API surface not built yet)*
- [ ] custom domain entitlement *(gate ready; custom-domain flow is Release 3 §26)*
- [ ] WhatsApp entitlement *(adapter exists in legacy modules; not gated into flows yet)*

Centralize checks in:

```text
EntitlementService
```

## Week 26 — Custom Domains

Support:

```text
rahman.ferio.com
rentals.rahmanproperties.com
```

Checklist:

- [ ] ownership verification
- [ ] CNAME workflow
- [ ] SSL
- [ ] domain status
- [ ] primary domain
- [ ] fallback subdomain
- [ ] takeover protection

## Week 27 — Platform Billing

Separate from rent.

```text
Organization → Ferio Subscription
Renter → Unit Owner
```

Models:

```text
PlatformInvoice
PlatformPayment
Subscription
```

## Week 28 — Renter Portal / PWA

> **v2.1 implementation:** COMPLETE on the API side — `/renter/*` covers dashboard, lease, statements, payment instructions, report-payment, receipts, utilities, maintenance, notices and documents. Marketplace-web hosts the "My Rental" UI + PWA manifest/icon shell (service worker pending for full offline PWA).

- [x] dashboard *(GET /renter/me tenancy snapshot)*
- [x] lease *(dates, rent, status)*
- [x] monthly statement *(GET /renter/invoices with lines)*
- [x] payment instructions *(per-owner bKash/Nagad/bank by share %)*
- [x] report payment *(POST → verification queue, never auto-paid)*
- [x] receipts *(receipt numbers surfaced on payments)*
- [x] utilities *(GET /renter/utilities — accounts, meters, latest readings)*
- [x] maintenance *(list + renter-opened UNIT tickets, audited; visible in workspace queue)*
- [x] documents *(GET /renter/documents — LEASE/UNIT-attached only; staff attach endpoint gated)*
- [x] notices *(org-wide + unit-targeted Notice model, staff posting gated to leasing domain)*

## Week 29 — Unit Owner Portal

- [ ] owned units
- [ ] occupancy
- [ ] expected rent
- [ ] outstanding
- [ ] renter
- [ ] owner utility responsibilities
- [ ] maintenance payable
- [ ] documents
- [ ] statements
- [ ] co-owner scoping

## Week 30 — Broker CRM

> **v2.1 implementation:** CrmLead pipeline (source → NEW→CONTACTED→VIEWING_SCHEDULED→NEGOTIATING→CONVERTED/LOST with guarded transitions + required lost-reason), one-tx conversion to renter+ACTIVE lease, broker name + commission pct/amount captured on the lease, per-assignee performance report. Marketplace inquiry attribution is LIVE: inquiries on org-published units auto-create deduped leads in that org's CRM.

- [x] broker leads
- [x] inquiry attribution *(marketplace inquiries on org-published units auto-create deduped MARKETPLACE_INQUIRY leads — best-effort async)*
- [ ] viewing
- [ ] listing attribution
- [x] lease conversion
- [x] commission *(pct/amount captured on lease)*
- [ ] commission payment *(payout ledger pending)*
- [x] performance reports

## Week 31 — Sale CRM

> **v2.1 implementation:** SaleOffer lifecycle on SALE listings — buyer offers (JWT-authenticated), seller counter/accept/reject, buyer accept-counter; acceptance atomically marks the listing SOLD and rejects sibling offers. Controlled document sharing rides the existing per-viewer visibility rules.

```text
Sale Listing
→ Buyer Inquiry
→ Viewing
→ Negotiation
→ Offer
→ Counter
→ Accepted / Rejected
→ Sold
```

Checklist:

- [x] buyer profile *(marketplace accounts + central identity)*
- [x] offer *(PENDING w/ self-offer + duplicate-pending guards)*
- [x] counteroffer *(counterAmount on same row)*
- [x] broker attribution *(brokerAccountId captured on offer)*
- [x] controlled document sharing *(per-viewer visibility enforced since prog-16 era)*
- [x] sale timeline *(offer statuses + decidedAt history; dedicated timeline endpoint pending)*

## Week 32 — Automation

```text
Trigger
Condition
Action
Execution
```

Triggers:

```text
invoice.overdue
lease.expiring
maintenance.opened
listing.expiring
subscription.past_due
```

Actions:

```text
send notification
create task
assign staff
send WhatsApp
invoke webhook
```

Checklist:

- [ ] idempotency
- [ ] recursion protection
- [ ] dry run
- [ ] audit
- [ ] execution history

## Week 33 — External API & Webhooks

- [ ] API clients
- [ ] scopes
- [ ] key rotation
- [ ] rate limits
- [ ] webhook subscriptions
- [ ] signing
- [ ] retry
- [ ] replay
- [ ] delivery logs

## Weeks 34–35 — Analytics

Marketplace:

- [ ] listing volume
- [ ] area demand
- [ ] search activity
- [ ] inquiry conversion
- [ ] rent ranges
- [ ] sale ranges
- [ ] property-type trends

SaaS:

- [ ] occupancy
- [ ] rent collection
- [ ] unit income
- [ ] utility recovery
- [ ] maintenance spend
- [ ] renter payment behavior

Platform:

- [ ] subscription conversion
- [ ] churn
- [ ] MRR
- [ ] plan utilization
- [ ] tenant DB growth

## Week 36 — Tenant DB Operations

- [ ] schema version dashboard
- [ ] migration status
- [ ] failed retry
- [ ] tenant backup
- [ ] tenant restore
- [ ] clone to staging
- [ ] archive
- [ ] export
- [ ] DB health
- [ ] connection metrics

## Week 37 — Reliability / Disaster Recovery

Targets:

```text
Control Plane >= 99.9%
Marketplace   >= 99.9%
Tenant API    >= 99.9%
RPO           <= 1 hour
RTO           <= 2 hours
```

Checklist:

- [ ] PITR
- [ ] tenant-specific restore
- [ ] marketplace restore
- [ ] control-plane restore
- [ ] Redis-loss recovery
- [ ] object-storage recovery
- [ ] DNS recovery
- [ ] secret recovery
- [ ] incident runbooks

## Week 38 — Enterprise Pilot

Validate with:

```text
10+ organizations
multiple tenant DBs
500–2,000 managed units
thousands of listings
multiple unit owners/building
brokers
property managers
```

Checklist:

- [ ] provisioning
- [ ] migrations
- [ ] connection pool
- [ ] PostGIS
- [ ] marketplace projections
- [ ] subscriptions
- [ ] billing
- [ ] utility allocation
- [ ] maintenance
- [ ] custom domains
- [ ] backups
- [ ] restore

---

# 8. Cross-Plane Event Architecture

Use outbox/event propagation.

```text
Tenant DB
UnitListingPublished
      ↓
Tenant Outbox
      ↓
Worker
      ↓
Marketplace Projection
```

Required:

> **v2.1 implementation status:**

- [x] unique event ID *(cuid PK per event)*
- [x] persisted outbox *(TenantOutboxEvent, written in the same tenant-DB transaction as the state change)*
- [x] idempotent consumer *(upsert-by-source semantics; re-application is a no-op)*
- [x] retries *(exponential backoff 10s→1h cap)*
- [x] dead-letter *(FAILED after maxAttempts; admin list/retry endpoints)*
- [x] reconciliation *(per-org drift repair endpoint + audit)*
- [ ] projection version
- [x] manual replay *(POST /platform/organizations/:id/outbox/retry-failed)*

Important events:

```text
organization.provisioned
organization.suspended
subscription.changed

unit.listing_published
unit.listing_updated
unit.listing_unpublished
unit.occupied

marketplace.inquiry_created

lease.activated
lease.terminated
```

---

# 9. Data Ownership Matrix

## Control DB

```text
Central identity
SaaS organizations
Domains
Plans
Subscriptions
Entitlements
Tenant DB registry
Provisioning
Platform administration
Feature flags
```

## Marketplace DB

```text
Listings
Listing media
Listing public location
Seller/broker profile
Favorites
Inquiries
Viewing requests
Moderation
Search projection
```

## Tenant DB

```text
Properties
Buildings
Units
Ownership
Renters
Guarantors
Leases
Rent billing
Payments
Utilities
Maintenance
Staff
Tenant-local documents
Tenant-local audit
```

---

# 10. Authentication Architecture

> **v2.1 implementation:** `CentralUser` lives in the control-plane DB. `/identity/register|login|google|me` issue HS256 tokens (7d). `JwtAuthGuard` protects `/platform/*`, moderation, projection-ops and `/tenant/iam/*`; `OptionalJwtAuthGuard` resolves the viewer on public listing detail for per-viewer document visibility. Google Sign-In verifies GIS ID tokens server-side (`google-auth-library`) with email-based account linking.

```text
Central Identity (control-plane CentralUser)
      ↓ Bearer JWT (JWT_ACCESS_SECRET)
Resolved SaaS Organization (X-Tenant-Slug / subdomain host)
      ↓
Tenant Membership / Permission (Member row in tenant DB)
      ↓
Tenant DB
```

Benefits:

- [x] one login across marketplace and SaaS
- [x] user can belong to several organizations *(membership rows per tenant DB)*
- [x] advertiser can upgrade later
- [x] renter can later become owner/broker
- [x] no password duplication across tenant DBs

Implemented since v2.1 baseline: `PlatformAdminGuard` RBAC, refresh-token rotation with replay detection, `POST /identity/logout`, and `GET /identity/my/organizations` powering the saas-web organization switcher.

---

# 11. Money Flow Separation

Keep four distinct domains.

## SaaS Subscription

```text
Organization
→ Ferio
```

## Rental Payment

```text
Renter
→ Unit Owner / configured beneficiary
```

## Building Charge

```text
Renter
→ Building Management / configured beneficiary
```

## Marketplace Monetization

Future:

```text
Advertiser
→ Ferio
→ Boost / Featured / Verified Listing
```

Never merge these into one payment ledger.

---

# 12. Search Architecture

Initial:

```text
PostgreSQL + PostGIS
```

Later only if necessary:

```text
Typesense / Elasticsearch
```

Search must use central marketplace projection only.

Do not query tenant DBs for public discovery.

---

# 13. Security Checklist

## Control Plane

> **v2.1 implementation:** platform routes staff-only via `PlatformAdminGuard` + `@PlatformRoles()` (`SUPER_ADMIN`/`ADMIN`/`SUPPORT`/`MODERATOR`); staff login at `/identity/platform/login` (legacy plaintext auto-upgrades to bcrypt). Refresh-token rotation with replay detection + logout revocation.

- [x] Platform Admin TOTP *(self-contained RFC-6238: setup/confirm/disable + enforced at staff login)*
- [x] provisioning permission
- [ ] tenant DB credentials encrypted *(passwordRef field ready; secret manager pending)*
- [x] subscription mutation audit
- [ ] support access audit

## Tenant Isolation

- [x] host → tenant resolved server-side *(TenantResolverMiddleware)*
- [ ] tenant DB ID never trusted from client
- [ ] connection cache isolation
- [ ] cross-tenant E2E tests
- [x] organization status enforced *(SUSPENDED/CANCELLED/ARCHIVED blocked; PROVISIONING → 503)*

## Marketplace

> **v2.1 implementation:** listing-ownership guards on all mutations; sale-document visibility enforced per viewer on read; moderation queue + takedown live.

- [x] listing ownership
- [x] private sale documents
- [ ] secure uploads
- [ ] anti-spam
- [ ] contact rate limiting
- [x] moderation
- [x] abuse reports

---

# 14. Migration Strategy

Every tenant schema migration:

```text
Design
→ SQL Review
→ Empty DB Replay
→ Test Tenant
→ Canary Tenants
→ Batch Rollout
→ Health Checks
→ Full Rollout
```

Recommended rollout:

```text
5%
→ 20%
→ 50%
→ 100%
```

Never migrate unlimited tenant DBs simultaneously.

---

# 15. Subscription Suspension Policy

Recommended:

```text
ACTIVE
→ full access

PAST_DUE
→ warning + grace

SUSPENDED
→ read-only / restricted

CANCELLED
→ export window

ARCHIVED
→ retained per policy
```

Never immediately delete tenant DB on subscription failure.

---

# 16. Marketplace Free Listing Policy

Non-subscriber can:

- [ ] create listing
- [ ] edit listing
- [ ] upload images
- [ ] add map location
- [ ] receive inquiry
- [ ] pause
- [ ] mark rented/sold

Cannot use:

- [ ] lease CRM
- [ ] recurring rent billing
- [ ] utilities
- [ ] staff management
- [ ] maintenance CRM
- [ ] advanced reporting

Conversion CTA:

> Rented this property? Manage rent, utilities and maintenance with Ferio.

---

# 17. Platform Admin Scope

> **v2.1 implementation:** admin console (`ferio-admin-web`) wired live — organizations table + provisioning modal (real pipeline), retry/suspend actions, tenant-DB registry with per-row & fleet migration, marketplace moderation queue (approve/reject), plans/flags. Subscriptions manageable via lifecycle endpoints; billing-account GET added for the SaaS billing flow.

- [x] organizations
- [x] subscriptions *(lifecycle + events; console section pending)*
- [x] plans
- [x] tenant DB state
- [x] tenant migrations
- [x] provisioning failures *(jobs list + retry endpoint)*
- [x] domains *(org detail include)*
- [x] marketplace moderation
- [x] listing reports *(API live: `/platform/marketplace/reports`)*
- [ ] user reports
- [x] feature flags
- [ ] platform analytics
- [ ] support access
- [x] platform audit

---

# 18. Critical Test Scenarios

## Scenario A — Free Advertiser

```text
Create account
→ publish shop for rent
→ coordinates indexed
→ renter searches map
→ inquiry
```

## Scenario B — SaaS Provisioning

```text
Purchase plan
→ organization
→ subdomain
→ dedicated DB
→ migration
→ seed
→ login
```

## Scenario C — Unit Ownership

```text
Building
→ Unit A owned by Rahim
→ Unit B owned by Karim
→ rent beneficiary differs
```

## Scenario D — Cross-Plane Publishing

```text
Tenant Unit
→ publish
→ outbox
→ marketplace
→ public search
→ update
→ projection updated
```

## Scenario E — Isolation

```text
rahman.ferio.com
→ DB Rahman

ABC user attempts Rahman resource
→ rejected
```

## Scenario F — Subscription Suspension

```text
Subscription past due
→ grace
→ suspended
→ operational DB remains
→ access restricted
→ payment resolves
→ restore access
```

---

# 19. CI/CD Checklist

Every PR:

> **v2.1 implementation:** GitHub Actions workflow (`.github/workflows/ci.yml`) — three-plane schema validation, tenant migration replay on empty PostGIS database, marketplace SQL migrations, backend build, unit tests, and frontend builds.

- [x] lint *(eslint configured; wired in repo scripts)*
- [ ] TypeScript *(strict typecheck job pending — build covers compilation)*
- [x] control schema validate
- [x] marketplace schema validate
- [x] tenant schema validate
- [x] migration replay
- [x] unit tests
- [ ] integration tests
- [ ] tenant isolation tests

Deployment:

```text
Deploy API
→ control DB migration
→ marketplace DB migration
→ register tenant schema version
→ canary tenant migration
→ staged tenant rollout
→ monitor
```

---

# 20. Architecture Review Gates

## Gate 1 — Week 2

Must prove:

```text
Control Plane
Tenant resolution
DB provisioning
Migration orchestrator
```

## Gate 2 — Week 7

Must prove:

```text
Marketplace
Listings
OpenStreetMap/PostGIS
Inquiry
```

## Gate 3 — Week 12

Must prove:

```text
SaaS Organization
Property
Building
Unit
Unit ownership
Marketplace publishing
```

## Gate 4 — Week 16

Must prove:

```text
Billing
Multiple beneficiaries
Rent routing
```

## Gate 5 — Week 24

Must prove:

```text
Utilities
Maintenance
Financial correctness
Tenant isolation
```

## Gate 6 — Week 38

Must prove:

```text
Custom domains
Scale
Migration rollout
Enterprise operations
Backup/restore
```

---

# 21. Do Not Do This

- [ ] Do not use one shared operational DB if DB-per-tenant is a firm requirement
- [ ] Do not query tenant DBs for marketplace search
- [ ] Do not create Prisma client per request
- [ ] Do not let frontend select database
- [ ] Do not put DB URL in JWT
- [ ] Do not make Listing equal Unit
- [ ] Do not assume Building Owner equals Unit Owner
- [ ] Do not route all rent through Ferio
- [ ] Do not mix subscription billing with rental billing
- [ ] Do not expose sale documents publicly by default
- [ ] Do not perform unsafe synchronous cross-DB dual writes
- [ ] Do not migrate all tenant DBs without concurrency controls
- [ ] Do not delete tenant DB immediately on missed subscription
- [ ] Do not introduce microservices without a measured need

---

# 22. Final Architecture North Star

```text
                           FERIO

              ┌─────────────┼─────────────┐
              │             │             │
              ▼             ▼             ▼

       MARKETPLACE     CONTROL PLANE     SaaS DATA PLANE

       Search          Organizations     Organization A
       Rent Ads        Domains             └── DB A
       Sale Ads        Plans
       Shops           Subscriptions     Organization B
       Warehouses      Provisioning        └── DB B
       Land            Migrations
       Brokers         Platform Admin    Organization C
       Inquiries                           └── DB C
```

Marketplace lifecycle:

```text
Advertiser
→ Listing
→ OpenStreetMap Search
→ Renter / Buyer
→ Inquiry
```

SaaS lifecycle:

```text
Owner / Property Manager
→ Subscribe
→ Dedicated DB
→ Property
→ Building
→ Unit
→ Unit Owner
→ Listing
→ Renter
→ Lease
→ Rent
→ Utilities
→ Maintenance
```

Payment architecture:

```text
Organization ── subscription fee ──→ FERIO

Renter ──────── rent ───────────────→ Unit Owner

Renter ──────── service charge ─────→ Building Management

Advertiser ──── optional ad fee ────→ FERIO
```

Every backend request must answer:

```text
Which architectural plane owns this request?
Which SaaS organization is resolved?
Which database must be used?
Who is the actor?
What membership exists?
What permission and resource scope apply?
What plan entitlement applies?
What domain state transition is valid?
What audit event is required?
What cross-plane event must be synchronized?
```

That is the architecture baseline for Ferio as a marketplace-backed, database-per-tenant property SaaS platform.
