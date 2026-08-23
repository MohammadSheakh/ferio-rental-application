# Ferio Rental — Implementation Checklist & Schedule

**Document Type:** Backend Implementation Plan / Delivery Checklist  
**Product:** Ferio Rental — Property Operations, Leasing & Rental CRM  
**Primary Stack:** NestJS + Prisma + PostgreSQL + Redis + BullMQ  
**Architecture:** Modular Monolith with explicit bounded contexts  
**Target Market:** Bangladesh-first, SaaS-ready  
**Audience:** Backend engineers, tech lead, solution architect, DevOps, QA, frontend integrators  
**Version:** 1.0

---

## 1. Delivery Philosophy

This plan is intentionally a **production engineering plan**, not a CRUD feature checklist. The backend must be built around explicit domain boundaries, organization-level tenant isolation, auditable state transitions, immutable financial history, idempotent background jobs, safe payment/webhook processing, scoped authorization, deterministic billing, migration-safe relational modeling, and observability from Release 1.

The first production goal is:

> A property operator can onboard a property, process a lead, approve a tenant, activate a lease, generate rent, record payment, handle maintenance, and close the accounting period without using spreadsheets as the system of record.

---

## 2. Scope Strategy

### Release 1 — Operational Core

- [x] Authentication
- [x] Organizations / workspaces
- [x] Users / staff / permissions
- [x] Owner and person directory
- [x] Property / building / unit inventory
- [x] Leads / CRM activities / viewings
- [x] Rental applications
- [x] Guarantors
- [x] Verification checklist
- [x] Leases and lease parties
- [x] Security deposits
- [x] Recurring charges
- [x] Invoices and invoice lines
- [x] Payments and allocations
- [x] Tenant ledger
- [x] Cash/manual payment workflow
- [x] Basic maintenance
- [x] Vendor directory / work orders
- [x] Documents
- [x] Notifications
- [x] Audit logging
- [x] Dashboard KPIs
- [x] Core operational reports
- [x] Background jobs
- [x] Production observability
- [x] Backup / recovery baseline

### Release 2 — Operations Depth

- [x] Utility billing / allocation
- [x] Meter readings
- [x] Inspections
- [x] Move-out workflow
- [x] Security deposit deductions/refunds
- [x] Lease renewals
- [x] Rent negotiation / rent increase
- [x] Expenses
- [x] Owner statements
- [x] Agent / broker commissions
- [x] WhatsApp integration
- [x] Online payment integrations
- [x] Advanced reconciliation

### Release 3 — Scale / SaaS Expansion

- [x] NRB owner portal
- [x] Multi-currency reporting
- [x] Owner payouts
- [x] Advanced accounting
- [x] Vendor portal
- [x] Full tenant PWA
- [x] Mobile app
- [x] SaaS subscriptions
- [x] Enterprise webhooks
- [x] External API
- [x] Workflow automation builder
- [x] Advanced analytics
- [x] Search-engine extraction if justified
- [x] Service extraction / microservices only where measurable need exists

---

## 3. Architectural Guardrails

### 3.1 Bounded Contexts

```text
src/
├── auth/
├── iam/
├── organizations/
├── people/
├── owners/
├── properties/
├── units/
├── crm/
│   ├── leads/
│   ├── activities/
│   └── viewings/
├── applications/
├── screening/
├── guarantors/
├── leasing/
│   ├── leases/
│   ├── lease-parties/
│   ├── negotiations/
│   ├── renewals/
│   └── terminations/
├── billing/
│   ├── recurring-charges/
│   ├── invoices/
│   └── invoice-lines/
├── payments/
├── ledger/
├── deposits/
├── expenses/
├── utilities/
├── meters/
├── maintenance/
├── work-orders/
├── vendors/
├── inspections/
├── documents/
├── communications/
├── notifications/
├── agents/
├── commissions/
├── reports/
├── audit/
├── jobs/
├── integrations/
└── common/
```

### 3.2 Controllers

- [x] Validate input
- [x] Invoke application services
- [x] Map domain errors to API errors
- [x] No business logic in controllers
- [x] No direct Prisma calls from controllers
- [x] No direct third-party calls from controllers

### 3.3 Financial Data

Never implement financial truth as mutable totals only. Required concepts:

```text
Invoice
InvoiceLine
Payment
PaymentAllocation
DepositTransaction
LedgerEntry
Adjustment
Refund
```

### 3.4 Multi-Tenancy

- [x] `organizationId` on organization-owned aggregates
- [x] organization membership validation
- [x] permission validation
- [x] resource scope validation
- [x] cross-organization tests
- [x] never trust client-provided organization IDs without authorization

### 3.5 State Machines

Use commands such as:

```text
approveApplication()
activateLease()
issueInvoice()
recordPayment()
verifyCashPayment()
closeMaintenanceRequest()
terminateLease()
```

Do not expose arbitrary status patching.

### 3.6 Idempotency

Mandatory for:

- [x] invoice generation
- [x] payment creation
- [x] payment webhooks
- [x] refunds
- [x] recurring jobs
- [x] notifications
- [x] lease activation
- [x] imports / reconciliation

### 3.7 Audit

Sensitive mutations must create append-only audit events.

---

## 4. Definition of Done

A feature is done only when:

- [x] Prisma model / migration reviewed
- [x] migration applies from a fresh database
- [x] migration recovery impact considered
- [x] DTO validation implemented
- [x] authorization implemented
- [x] organization isolation implemented
- [x] business invariants enforced
- [x] transaction boundary reviewed
- [x] idempotency reviewed where relevant
- [x] structured errors added
- [x] structured logs added
- [x] audit event added where relevant
- [x] unit tests added
- [x] integration tests added
- [x] unauthorized-access tests added
- [x] cross-tenant tests added
- [x] API documented
- [x] frontend contract reviewed
- [x] seed / fixture impact reviewed
- [x] observability impact reviewed
- [x] pagination implemented where needed
- [x] N+1 review completed
- [x] release notes updated

---

## 5. Environments

### Local

- [x] PostgreSQL
- [x] Redis
- [x] NestJS API
- [x] worker process
- [x] dev object storage
- [x] seeded organization/admin
- [x] sample buildings/units/tenants

### CI

Every PR runs:

```text
lint
format check
TypeScript compile
Prisma validation
migration replay test
unit tests
integration tests
security-sensitive tests
```

### Staging

- [x] production-like schema
- [x] test payment credentials only
- [x] isolated Redis
- [x] isolated storage
- [x] workers running
- [x] webhook test endpoints
- [x] logs / monitoring

### Production

- [x] separate credentials
- [x] private PostgreSQL
- [x] private Redis
- [x] TLS
- [x] encrypted object storage
- [x] backup
- [x] monitoring
- [x] alerting
- [x] least-privilege IAM

---

## 6. Recommended Delivery Schedule

A realistic baseline for one strong backend engineer with AI assistance is **14–18 weeks for a credible Release 1**, assuming frontend work happens in parallel.

| Phase | Duration | Outcome |
|---|---:|---|
| Phase 0 — Architecture Foundation | Week 1 | Project baseline and domain contracts |
| Phase 1 — Identity & Organization | Weeks 2–3 | Secure multi-tenant platform |
| Phase 2 — Property Inventory | Weeks 4–5 | Owner/property/building/unit system |
| Phase 3 — Leasing CRM | Weeks 6–7 | Lead-to-application workflow |
| Phase 4 — Lease Lifecycle | Weeks 8–9 | Approval-to-active-lease workflow |
| Phase 5 — Billing & Payments | Weeks 10–12 | Financial system of record |
| Phase 6 — Maintenance & Documents | Week 13 | Operational service workflows |
| Phase 7 — Reports / Hardening | Weeks 14–15 | Pilot-ready backend |
| Phase 8 — Pilot Stabilization | Weeks 16–18 | Real-usage fixes and production gate |

---

# 7. Phase 0 — Architecture Foundation

## Week 1

### Architecture

- [x] Freeze bounded-context map
- [x] Define terminology glossary
- [x] Define aggregate ownership
- [x] Define organization isolation strategy
- [x] Define money representation
- [x] Define ID strategy
- [x] Define API versioning
- [x] Define error envelope
- [x] Define pagination standards
- [x] Define timezone/date policy
- [x] Define deletion / archival policy
- [x] Define audit strategy
- [x] Define file-storage strategy
- [x] Define event/outbox strategy
- [x] Define Redis usage
- [x] Define BullMQ queues
- [x] Define idempotency policy

### Database

- [x] Initial Prisma schema skeleton
- [x] Migration naming rules
- [x] Fresh-database migration replay
- [x] Database constraints for invariants
- [x] Indexing policy
- [x] Common timestamp conventions

### Common Backend

- [x] global validation pipe
- [x] structured API errors
- [x] correlation/request ID
- [x] logging interceptor
- [x] global exception filter
- [x] health endpoint
- [x] readiness endpoint
- [x] liveness endpoint
- [x] config validation
- [x] environment validation
- [x] security headers
- [x] rate-limit baseline
- [x] CORS policy
- [x] OpenAPI baseline

### Test Foundation

- [x] test database bootstrap
- [x] fixture factories
- [x] auth test helpers
- [x] organization fixture
- [x] integration-test harness

### Exit Gate

- [x] fresh DB migrates successfully
- [x] API boots
- [x] Redis boots
- [x] CI runs
- [x] correlation ID appears in logs
- [x] organization-scope design documented

---

# 8. Phase 1 — Identity, IAM & Organization

## Week 2 — Organization & Membership

### Schema

- [x] `Organization`
- [x] `OrganizationMember`
- [x] `User`
- [x] `UserSession`
- [x] `Role`
- [x] `Permission`
- [x] role-permission mapping
- [x] member-role mapping

### Organization

- [x] create organization
- [x] update organization
- [x] status
- [x] settings
- [x] locale
- [x] timezone
- [x] currency

### Membership

- [x] invite member
- [x] accept invite
- [x] revoke invite
- [x] disable member
- [x] remove member
- [x] restore member

### Authentication

- [x] password hashing
- [x] login
- [x] logout
- [x] session rotation
- [x] session lifecycle
- [x] throttling/lockout
- [x] email verification
- [x] password reset

## Week 3 — Permissions & Delegation

### Authorization

- [x] permission guard
- [x] organization guard
- [x] resource scope guard
- [x] property scope
- [x] building scope
- [x] role composition

### Delegation

- [x] delegation model
- [x] effective date
- [x] expiration date
- [x] permission subset
- [x] revoke delegation
- [x] audit delegation

### Staff Security

- [x] admin TOTP/MFA design
- [x] session listing
- [x] session revocation
- [x] security-event logging

### Critical Tests

- [x] cross-organization access rejected
- [x] building scope enforced
- [x] expired delegation rejected
- [x] revoked delegation rejected
- [x] disabled membership rejected
- [x] privilege escalation rejected

### Exit Gate

- [x] organization isolation proven by automated tests
- [x] authorization decisions centralized
- [x] no domain module invents separate auth logic

---

# 9. Phase 2 — Property Inventory

## Week 4 — People, Owners & Property

### People

- [x] canonical `Person`
- [x] phone normalization
- [x] email normalization
- [x] addresses
- [x] identity-document references
- [x] emergency contacts

### Owner

- [x] owner profile
- [x] individual owner
- [x] corporate owner
- [x] contact preference
- [x] payment/bank metadata placeholders

### Property

- [x] property model
- [x] property type
- [x] address
- [x] district / area
- [x] latitude / longitude
- [x] status
- [x] notes
- [x] property documents

### Ownership

- [x] property ownership relation
- [x] multiple owners
- [x] ownership percentage
- [x] effective period
- [x] primary contact
- [x] ownership history

## Week 5 — Buildings & Units

### Buildings

- [x] CRUD
- [x] floors
- [x] amenities
- [x] building status

### Units

- [x] CRUD
- [x] unit type
- [x] area
- [x] bedrooms/bathrooms
- [x] market rent
- [x] target rent
- [x] status

### Unit States

```text
DRAFT
AVAILABLE
RESERVED
OCCUPIED
NOTICE_GIVEN
MOVE_OUT_PENDING
MAINTENANCE_HOLD
BLOCKED
```

- [x] controlled transitions
- [x] state history
- [x] audit

### List APIs

- [x] offset pagination
- [x] filtering
- [x] sorting whitelist
- [x] occupancy filters
- [x] availability filters
- [x] district / area filters

### Exit Gate

The model must support:

- [x] standalone apartment
- [x] full apartment building
- [x] multiple buildings
- [x] co-ownership
- [x] delegated manager

without schema hacks.

---

# 10. Phase 3 — Leasing CRM

## Week 6 — Leads, Activities & Viewings

### Leads

- [x] rental lead
- [x] source
- [x] interested unit
- [x] budget
- [x] move-in date
- [x] family size
- [x] occupation
- [x] assigned staff

### Lead States

```text
NEW
CONTACTED
QUALIFIED
VIEWING_SCHEDULED
VIEWING_COMPLETED
INTERESTED
APPLICATION
WON
LOST
ARCHIVED
```

- [x] controlled transitions
- [x] lost reason
- [x] history

### CRM Activity

- [x] phone call
- [x] WhatsApp
- [x] email
- [x] meeting
- [x] note
- [x] follow-up
- [x] reminder

### Viewings

- [x] schedule
- [x] assign employee/agent
- [x] reschedule
- [x] cancel
- [x] complete
- [x] prospect feedback
- [x] employee feedback
- [x] next follow-up

## Week 7 — Applications, Guarantors & Screening

### Application

- [x] application aggregate
- [x] applicant
- [x] co-applicants
- [x] unit
- [x] expected move-in
- [x] offered rent
- [x] occupation
- [x] employer
- [x] income
- [x] current address
- [x] previous landlord
- [x] occupants
- [x] emergency contacts
- [x] documents

### Application States

```text
DRAFT
SUBMITTED
UNDER_REVIEW
DOCUMENT_PENDING
VERIFICATION
APPROVED
CONDITIONALLY_APPROVED
REJECTED
WITHDRAWN
EXPIRED
```

### Guarantors

- [x] multiple guarantors
- [x] relationship
- [x] contact
- [x] guarantor type
- [x] income proof
- [x] verification state
- [x] notes

### Screening / Verification

- [x] NID collected
- [x] phone verified
- [x] employer contacted
- [x] previous landlord contacted
- [x] guarantor contacted
- [x] income reviewed
- [x] permanent address reviewed
- [x] waiver support
- [x] evidence

### Approval

- [x] approve
- [x] conditional approve
- [x] reject with reason
- [x] permission check
- [x] audit

### Exit Gate

- [x] Lead → application → verification → approval works with full history

---

# 11. Phase 4 — Lease Lifecycle

## Week 8 — Lease & Parties

### Lease

- [x] lease number
- [x] unit
- [x] start/end dates
- [x] rent
- [x] service charge
- [x] deposit
- [x] billing frequency
- [x] due day
- [x] grace period
- [x] notice period
- [x] renewal policy

### Lease Parties

- [x] primary tenant
- [x] co-tenant
- [x] occupant
- [x] guarantor
- [x] financially responsible flag

### Lease States

```text
DRAFT
PENDING_APPROVAL
PENDING_SIGNATURE
SIGNED
ACTIVE
NOTICE_GIVEN
EXPIRING
EXPIRED
TERMINATED
CANCELLED
```

### Invariants

- [x] no overlapping active exclusive lease per unit
- [x] signed lease terms cannot silently mutate
- [x] activation validates mandatory terms
- [x] tenant exists
- [x] unit availability is valid

## Week 9 — Move-In & Deposit

### Deposit

- [x] deposit account
- [x] deposit transaction
- [x] required amount
- [x] amount received
- [x] adjustments
- [x] refund
- [x] balance

### Move-In

- [x] checklist
- [x] deposit collected
- [x] advance collected
- [x] keys issued
- [x] initial meter-readings placeholder
- [x] documents complete
- [x] occupancy confirmed

### Lease Activation Transaction

Atomically:

```text
validate lease
validate unit
activate lease
mark unit occupied
create occupancy
create billing account
create recurring charge rules
create deposit account
write audit events
```

### Tests

- [x] double activation prevented
- [x] concurrent activation prevented
- [x] active-lease uniqueness enforced
- [x] failed transaction rolls back

### Exit Gate

- [x] approved application → active lease → occupied unit works without manual DB edits

---

# 12. Phase 5 — Billing & Payments

## Week 10 — Billing Foundation

### Billing Account

- [x] lease link
- [x] account state
- [x] currency

### Recurring Charges

- [x] rent
- [x] service charge
- [x] parking
- [x] fixed utility
- [x] custom recurring charge

### Invoice

- [x] invoice number
- [x] invoice lines
- [x] issue date
- [x] due date
- [x] grace period
- [x] subtotal
- [x] adjustments
- [x] total
- [x] balance

### Invoice States

```text
DRAFT
ISSUED
PARTIALLY_PAID
PAID
OVERDUE
VOID
WRITTEN_OFF
```

### Scheduled Invoice Generation

- [x] BullMQ worker
- [x] deterministic job ID
- [x] lease/period idempotency key
- [x] duplicate constraint
- [x] retry strategy
- [x] failed-job review

## Week 11 — Payments & Allocation

### Payment

- [x] amount
- [x] method
- [x] paidAt
- [x] external/manual reference
- [x] collector
- [x] payer
- [x] proof
- [x] verification status

### Payment Methods

- [x] cash
- [x] bank transfer
- [x] manual bKash
- [x] manual Nagad
- [x] cheque
- [x] other MFS

### Allocation

- [x] partial payment
- [x] one payment → multiple invoices
- [x] multiple payments → one invoice
- [x] unallocated balance
- [x] overpayment handling

### Cash Verification

```text
RECORDED
PENDING_VERIFICATION
VERIFIED
REJECTED
```

- [x] optional maker/checker
- [x] receipt generation
- [x] collector audit
- [x] immutable verification event

## Week 12 — Ledger & Financial Hardening

### Ledger

- [x] ledger account
- [x] ledger entry
- [x] reference types
- [x] debit/credit rules
- [x] transaction grouping
- [x] immutable entry policy

### Financial Reporting Foundation

- [x] tenant balance
- [x] rent due
- [x] rent collected
- [x] outstanding
- [x] security deposits held
- [x] cash collection
- [x] payment history

### Aging

- [x] overdue worker
- [x] 0–30
- [x] 31–60
- [x] 61–90
- [x] 90+

### Financial Tests

- [x] partial payment
- [x] duplicate payment reference
- [x] double allocation
- [x] payment reversal
- [x] void invoice
- [x] concurrent payment
- [x] duplicate invoice job
- [x] retry after failure
- [x] stale retry cannot double-post
- [x] monetary precision

### Exit Gate

For any tenant the system must answer exactly:

```text
What was billed?
What was paid?
When?
How?
Who recorded it?
Which invoice did it settle?
What remains outstanding?
```

---

# 13. Phase 6 — Maintenance, Vendors & Documents

## Week 13

### Maintenance

- [x] maintenance request
- [x] property/unit link
- [x] reporter
- [x] category
- [x] urgency
- [x] description
- [x] photos
- [x] state
- [x] assigned employee

### State

```text
OPEN
TRIAGED
ASSIGNED
SCHEDULED
IN_PROGRESS
WAITING_PARTS
RESOLVED
TENANT_CONFIRMED
CLOSED
REOPENED
CANCELLED
```

### Vendors / Work Orders

- [x] vendor profile
- [x] specialty
- [x] phone / WhatsApp
- [x] service areas
- [x] work-order creation
- [x] multiple work orders per ticket
- [x] estimated cost
- [x] actual cost
- [x] before/after photos
- [x] completion notes

### Documents

- [x] document metadata
- [x] category
- [x] owner resource
- [x] private storage
- [x] signed URL
- [x] upload authorization
- [x] download authorization
- [x] file-type restriction
- [x] size restriction
- [x] malware-scanning hook placeholder
- [x] access audit

### Exit Gate

- [x] maintenance request can be tracked from report to verified closure with evidence

---

# 14. Phase 7 — Notifications, Reports, Security & Reliability

## Week 14 — Notifications / Reports

### Notifications

- [x] outbox/event model
- [x] notification jobs
- [x] email adapter
- [x] SMS interface
- [x] WhatsApp interface
- [x] push interface
- [x] retries
- [x] failure logging
- [x] delivery status
- [x] template model

### Domain/Application Events

```text
application.approved
lease.signed
lease.activated
invoice.issued
invoice.overdue
payment.recorded
payment.verified
maintenance.created
maintenance.assigned
lease.expiring
```

### Release 1 Reports

- [x] rent roll
- [x] occupancy
- [x] vacancy
- [x] collections
- [x] outstanding
- [x] aging
- [x] tenant ledger
- [x] payment register
- [x] security deposit
- [x] lease expiry
- [x] maintenance summary

### Export

- [x] CSV
- [x] export permissions
- [x] large-export async job
- [x] audit export downloads

## Week 15 — Hardening

### Security

- [x] authorization review
- [x] OWASP-oriented review
- [x] rate limiting
- [x] login throttling
- [x] document authorization
- [x] secret management
- [x] session security
- [x] CORS review
- [x] SSRF protection for remote URLs
- [x] webhook verification framework
- [x] input-length limits
- [x] upload restrictions
- [x] audit tamper resistance

### Observability

- [x] correlation ID
- [x] structured logs
- [x] organization ID where safe
- [x] actor ID
- [x] duration
- [x] route
- [x] status
- [x] error code

### Metrics

- [x] requests/min
- [x] p95 latency
- [x] 5xx rate
- [x] DB pool saturation
- [x] Redis health
- [x] queue depth
- [x] failed jobs
- [x] oldest job
- [x] invoice failures
- [x] notification failures

### Performance

- [x] pagination on every list
- [x] query-plan review
- [x] indexes
- [x] N+1 review
- [x] large-organization tests
- [x] report-query review
- [x] async large exports

### Data Safety

- [x] DB backups
- [x] restore test
- [x] object-storage versioning/backup policy
- [x] retention baseline
- [x] destructive-action safeguards

### Exit Gate

- [x] backend ready for controlled pilot

---

# 15. Phase 8 — Pilot Stabilization

## Weeks 16–18

Do not fill these weeks with major new features.

### Pilot Dataset

- [x] 3 organizations
- [x] 10+ properties
- [x] 100+ units
- [x] vacant + occupied units
- [x] multiple owners
- [x] delegated manager
- [x] 50+ tenants
- [x] active leases
- [x] expired leases
- [x] partial payments
- [x] overdue payments
- [x] cash payments
- [x] maintenance tickets
- [x] rejected applications
- [x] guarantors

### Stabilization

- [x] fix API contract friction
- [x] fix incorrect domain assumptions
- [x] optimize slow queries
- [x] improve validation
- [x] improve errors
- [x] add missing indexes
- [x] close audit gaps
- [x] close authorization gaps
- [x] fix duplicate-job edge cases
- [x] verify reports against manual calculations
- [x] verify invoice totals
- [x] verify tenant ledgers
- [x] verify deposit balances

### Production Gate

- [x] migration replay passes
- [x] backup restore tested
- [x] cross-tenant security suite passes
- [x] finance suite passes
- [x] queue retries tested
- [x] dashboards exist
- [x] runbook exists
- [x] rollback procedure documented
- [x] data-export path exists
- [x] admin access recovery documented

---

# 16. Release 2 Schedule

Recommended **8–10 additional weeks** after Release 1 stabilizes.

## R2 Week 1 — Utilities

- [x] utility types
- [x] meters
- [x] readings
- [x] reading photos
- [x] utility bills
- [x] allocation rules
- [x] equal split
- [x] occupancy split
- [x] area split
- [x] percentage split
- [x] manual split
- [x] invoice posting

## R2 Week 2 — Inspections

- [x] templates
- [x] room/checklist items
- [x] condition states
- [x] photos
- [x] acknowledgment/signature
- [x] move-in inspection
- [x] move-out inspection
- [x] comparison

## R2 Week 3 — Move-Out & Deposit Settlement

- [x] notice
- [x] scheduling
- [x] final outstanding calculation
- [x] move-out inspection
- [x] damage charges
- [x] utility finalization
- [x] deposit deductions
- [x] deposit refund
- [x] unit release

## R2 Week 4 — Renewals & Rent Changes

- [x] expiry scheduler
- [x] renewal offer
- [x] rent proposal
- [x] counter offer
- [x] accepted terms
- [x] new lease/version
- [x] notice tracking

## R2 Week 5 — Expenses / Owner Statement

- [x] property expense
- [x] categories
- [x] receipt
- [x] vendor
- [x] approval
- [x] expense reporting
- [x] owner statement

## R2 Week 6 — Agent / Commission

- [x] agent profile
- [x] lead attribution
- [x] viewing attribution
- [x] lease attribution
- [x] commission rules
- [x] commission approval
- [x] commission payment
- [x] disputes

## R2 Week 7 — Payment Integration

- [x] provider abstraction
- [x] first online payment adapter
- [x] initiation
- [x] webhook
- [x] verification
- [x] idempotency
- [x] reconciliation
- [x] failure recovery

## R2 Week 8 — WhatsApp / Communication Automation

- [x] provider adapter
- [x] templates
- [x] rent reminder
- [x] maintenance notification
- [x] lease expiry reminder
- [x] communication history

## R2 Weeks 9–10 — Hardening

- [x] financial reconciliation
- [x] report verification
- [x] notification failure testing
- [x] load tests
- [x] permission regression
- [x] production-readiness review

---

# 17. Prisma Schema Review Checklist

Before accepting a major schema change:

- [x] Is this a real domain concept?
- [x] Is it historical or only current state?
- [x] Does it need effective dates?
- [x] Does it need `organizationId`?
- [x] Should deletion be allowed?
- [x] Does it need soft-delete / archival?
- [x] Is a DB unique constraint required?
- [x] Is a composite index needed?
- [x] Is a join model better than JSON?
- [x] Can data volume become high?
- [x] Does it participate in finance/audit?
- [x] Is migration safe for existing records?
- [x] Does migration replay from zero?

Avoid JSON for core relations such as:

```text
owners[]
leaseParties[]
payments[]
invoiceItems[]
agents[]
guarantors[]
```

Use relational models.

JSON is appropriate for:

- provider payload snapshots
- raw webhook evidence
- flexible metadata
- audit before/after snapshots
- integration-specific evidence

---

# 18. PostgreSQL Index Checklist

Likely high-value indexes:

```text
organizationId
organizationId + status
propertyId
buildingId
unitId
leaseId
personId
invoiceId
paymentId
createdAt
dueDate
lease.endDate
maintenance.status
application.status
```

Potential composites:

```text
(organizationId, status)
(organizationId, createdAt)
(organizationId, dueDate)
(unitId, status)
(leaseId, billingPeriod)
(invoiceId, status)
(propertyId, status)
```

Verify with actual query patterns rather than blindly indexing.

---

# 19. API Standards

### Single Resource

```json
{
  "data": {}
}
```

### Collection

```json
{
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5,
    "hasNextPage": true,
    "hasPreviousPage": false
  }
}
```

### Error

```json
{
  "error": {
    "code": "LEASE_ALREADY_ACTIVE",
    "message": "The lease is already active.",
    "requestId": "..."
  }
}
```

- [x] Admin lists use offset pagination
- [x] High-volume feeds can use cursor pagination
- [x] sorting fields whitelisted
- [x] filter fields whitelisted
- [x] idempotency key accepted where relevant

---

# 20. Security Checklist

### Authentication

- [x] hashed passwords
- [x] secure sessions/tokens
- [x] rotation
- [x] logout revocation
- [x] MFA for privileged users
- [x] brute-force protection

### Authorization

- [x] centralized permission guard
- [x] organization isolation
- [x] property scope
- [x] building scope
- [x] delegation expiry
- [x] sensitive action permissions

### Data

- [x] classify sensitive fields
- [x] audit NID/passport access
- [x] private files
- [x] signed URLs
- [x] no PII in logs
- [x] no secrets in repo

### Finance

- [x] maker/checker for cash where enabled
- [x] reversals audited
- [x] refunds audited
- [x] immutable ledger
- [x] no silent invoice mutation after payment

---

# 21. Testing Strategy

```text
Unit tests
   ↓
Domain/service tests
   ↓
Integration tests
   ↓
API contract tests
   ↓
Critical end-to-end flows
```

### E2E Scenario A — Leasing

```text
organization
→ property
→ unit
→ lead
→ viewing
→ application
→ guarantor
→ approval
→ lease
→ activation
```

### E2E Scenario B — Billing

```text
active lease
→ recurring rule
→ invoice
→ partial payment
→ allocation
→ final payment
→ invoice paid
→ correct tenant ledger
```

### E2E Scenario C — Cash

```text
cash recorded
→ pending verification
→ manager verifies
→ receipt
→ ledger
→ audit
```

### E2E Scenario D — Maintenance

```text
tenant reports issue
→ triage
→ vendor assignment
→ work order
→ completion
→ tenant confirmation
→ close
```

### E2E Scenario E — Security

```text
Organization A user
→ requests Organization B resource
→ rejected
→ security event/log
```

---

# 22. Queue / Job Design

Recommended queues:

```text
billing
payments
notifications
documents
reports
maintenance
reconciliation
system
```

Every job needs:

- [x] deterministic ID where appropriate
- [x] retry strategy
- [x] exponential backoff
- [x] max attempts
- [x] failure logging
- [x] correlation ID
- [x] organization ID
- [x] idempotent handler
- [x] dead-letter/manual-review strategy

---

# 23. Required Audit Events

```text
organization.created
member.invited
member.role_changed
delegation.created
delegation.revoked
property.created
ownership.changed
unit.status_changed
lead.created
application.submitted
application.approved
application.rejected
lease.created
lease.signed
lease.activated
lease.terminated
invoice.issued
invoice.voided
payment.recorded
payment.verified
payment.rejected
payment.reversed
deposit.received
deposit.adjusted
deposit.refunded
maintenance.created
maintenance.assigned
maintenance.closed
document.uploaded
document.downloaded
document.deleted
permission.changed
session.revoked
```

---

# 24. Observability Dashboard

### API

- [x] request rate
- [x] p50/p95/p99
- [x] 4xx
- [x] 5xx

### PostgreSQL

- [x] active connections
- [x] pool saturation
- [x] slow queries
- [x] transaction failures

### Redis

- [x] connection health
- [x] memory
- [x] evictions
- [x] latency

### Queues

- [x] waiting
- [x] active
- [x] failed
- [x] retrying
- [x] oldest waiting job

### Business Alerts

- [x] invoice-generation failure
- [x] duplicate invoice attempt
- [x] payment webhook failure
- [x] reconciliation mismatch
- [x] notification backlog
- [x] export failure
- [x] scheduled lease-reminder failure

---

# 25. Frontend Integration Contract Schedule

### By Week 3

- auth
- organization
- staff
- permissions

### By Week 5

- owner
- property
- building
- unit

### By Week 7

- lead
- activity
- viewing
- application
- guarantor

### By Week 9

- lease
- lease party
- deposit
- move-in

### By Week 12

- invoices
- payments
- tenant ledger
- reports

### By Week 13+

- maintenance
- work orders
- documents
- notifications

Use OpenAPI / contract fixtures so frontend work is not blocked by incomplete implementation.

---

# 26. Milestone Acceptance Criteria

## Milestone A — Platform Core (End Week 3)

```text
login
→ organization
→ staff
→ role
→ scoped permission
→ audit
```

## Milestone B — Inventory (End Week 5)

```text
owner
→ property
→ building
→ unit
```

## Milestone C — Leasing CRM (End Week 7)

```text
lead
→ viewing
→ application
→ guarantor
→ approval
```

## Milestone D — Occupancy (End Week 9)

```text
approved application
→ lease
→ deposit
→ activation
→ occupied unit
```

## Milestone E — Financial Core (End Week 12)

```text
active lease
→ invoice
→ payment
→ allocation
→ ledger
→ outstanding balance
```

## Milestone F — Pilot (End Week 15)

Demonstrate one complete simulated month of property operations.

---

# 27. First 25 Backend Tickets

1. [ ] Bootstrap configuration validation
2. [ ] Add request/correlation ID
3. [ ] Add structured error envelope
4. [ ] Add organization model
5. [ ] Add organization membership
6. [ ] Add role/permission system
7. [ ] Add organization authorization guard
8. [ ] Add scoped permissions
9. [ ] Add person directory
10. [ ] Add owner profile
11. [ ] Add property model
12. [ ] Add property ownership
13. [ ] Add building model
14. [ ] Add unit model
15. [ ] Add unit state transitions
16. [ ] Add lead model
17. [ ] Add CRM activity
18. [ ] Add viewing workflow
19. [ ] Add rental application
20. [ ] Add guarantors
21. [ ] Add verification checklist
22. [ ] Add application approval workflow
23. [ ] Add lease aggregate
24. [ ] Add lease parties
25. [ ] Add lease activation transaction

Then begin the financial modules.

---

# 28. Architecture Review Checkpoints

### Review 1 — End Week 1

- bounded contexts
- tenancy
- auth
- Prisma strategy
- audit
- events

### Review 2 — End Week 5

- property hierarchy
- owner relations
- unit states
- permission scopes

### Review 3 — End Week 9

- application-to-lease lifecycle
- lease invariants
- concurrency
- deposits

### Review 4 — End Week 12

- financial ledger
- allocations
- invoice idempotency
- reconciliation
- payment correctness

### Review 5 — End Week 15

- security
- performance
- observability
- backup / recovery
- launch risks

---

# 29. Project Risks & Mitigation

### Too many modules at once

**Mitigation:** vertical slices, milestone gates, no Release 2 work before Release 1 finance passes.

### Financial model becomes CRUD

**Mitigation:** ledger, append-oriented payment history, explicit reversal flows.

### Permission complexity

**Mitigation:** central IAM, scopes, permission matrix, regression tests.

### Prisma migration inconsistency

**Mitigation:** replay migrations from empty DB in CI, review SQL, never patch production schema manually.

### Bangladesh workflows assumed instead of observed

**Mitigation:** pilot early, make policy configurable, do not hardcode uncertain legal/business assumptions.

### Integrations block core product

**Mitigation:** provider abstractions; core workflows work without WhatsApp/payment-provider dependency.

---

# 30. Do-Not-Do Checklist

- [x] Do not put business logic in controllers
- [x] Do not use one giant role enum as the entire authorization model
- [x] Do not store owners as JSON arrays
- [x] Do not store financial line items only as mutable JSON
- [x] Do not store current balance as sole financial truth
- [x] Do not allow arbitrary status PATCH
- [x] Do not trust organization ID from client
- [x] Do not use floats for money
- [x] Do not expose private document URLs
- [x] Do not call bKash/WhatsApp directly from domain services
- [x] Do not depend only on webhooks
- [x] Do not build recurring billing without idempotency
- [x] Do not skip migration replay tests
- [x] Do not introduce microservices early
- [x] Do not add Kafka/Elasticsearch for architecture aesthetics
- [x] Do not build advanced AI before operational data exists
- [x] Do not release financial workflows without reconciliation tests

---

# 31. Release 1 Final Checklist

### Platform

- [x] auth
- [x] organizations
- [x] membership
- [x] permissions
- [x] scoped access
- [x] delegation
- [x] audit

### Property

- [x] people
- [x] owners
- [x] properties
- [x] ownership
- [x] buildings
- [x] units
- [x] unit states

### CRM

- [x] leads
- [x] activities
- [x] viewings
- [x] applications
- [x] guarantors
- [x] verification
- [x] approval

### Leasing

- [x] lease
- [x] lease parties
- [x] deposit
- [x] activation
- [x] occupancy

### Finance

- [x] recurring charges
- [x] invoice
- [x] invoice lines
- [x] payment
- [x] allocation
- [x] cash verification
- [x] ledger
- [x] aging
- [x] tenant balance

### Operations

- [x] maintenance
- [x] vendor
- [x] work order
- [x] documents
- [x] communication log

### Platform Services

- [x] notifications
- [x] queues
- [x] scheduled jobs
- [x] exports
- [x] reports
- [x] health endpoints
- [x] metrics
- [x] alerts

### Security

- [x] cross-tenant tests
- [x] permission tests
- [x] admin MFA
- [x] file access controls
- [x] rate limiting
- [x] session security
- [x] PII-safe logging

### Production

- [x] migration replay
- [x] DB backup
- [x] restore test
- [x] environment isolation
- [x] secret management
- [x] staging smoke test
- [x] runbook
- [x] rollback plan

---

# 32. Next Architecture Documents

Create these before deep implementation:

```text
01-product-requirements.md
02-domain-model.md
03-context-map.md
04-prisma-schema-design.md
05-api-contracts.md
06-iam-permission-matrix.md
07-state-machines.md
08-financial-ledger-design.md
09-event-catalog.md
10-background-jobs.md
11-security-threat-model.md
12-observability-runbook.md
13-deployment-architecture.md
14-test-strategy.md
15-data-retention-and-privacy.md
```

Highest-priority next documents:

1. Domain Model
2. Prisma Schema Design
3. IAM Permission Matrix
4. Lease State Machine
5. Billing + Ledger Design
6. Event Catalog

Do not implement the financial core until the lease state model and financial ledger design are agreed.

---

# 33. Architecture North Star

```text
Lead
 ↓
Application
 ↓
Verification
 ↓
Lease
 ↓
Occupancy
 ↓
Recurring Billing
 ↓
Invoice
 ↓
Payment
 ↓
Ledger
 ↓
Owner / Property Reporting
```

Parallel operations:

```text
Unit
 ↓
Maintenance
 ↓
Work Order
 ↓
Vendor
 ↓
Expense
 ↓
Audit / Reporting
```

Every mutation remains constrained by:

```text
Organization
    +
Permission
    +
Scope
    +
State Machine
    +
Transaction
    +
Audit
```

That is the engineering baseline for Ferio Rental.