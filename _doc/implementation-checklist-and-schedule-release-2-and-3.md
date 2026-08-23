# Ferio Rental — Release 2 & Release 3 Implementation Checklist and Schedule

**Document Type:** Backend Delivery Plan / Architecture Execution Checklist  
**Product:** Ferio Rental — Property Operations, Leasing & Rental CRM  
**Primary Stack:** NestJS + Prisma + PostgreSQL + Redis + BullMQ  
**Architecture:** Modular Monolith with explicit bounded contexts  
**Target Market:** Bangladesh-first, SaaS-ready  
**Version:** 1.0

---

# 1. Purpose

Release 1 establishes the operational system of record:

```text
Property
→ Lead
→ Application
→ Lease
→ Occupancy
→ Billing
→ Payment
→ Ledger
→ Maintenance
→ Reports
```

Release 2 deepens property operations and financial accuracy.

Release 3 turns the product into a scalable SaaS platform for larger property managers, NRB owners, external integrations, automation, mobile clients, and enterprise operations.

The implementation sequence must preserve these principles:

- no financial shortcut that breaks auditability
- no permission shortcut that breaks tenant isolation
- no external integration coupled directly to domain services
- no state transition exposed as arbitrary CRUD
- no production migration that cannot be replayed safely
- no background workflow without idempotency
- no large report/export executed synchronously
- no sensitive file without access control and audit
- no enterprise feature before the operational core is stable

---

# 2. Release 2 — Objective

## Release 2 Goal

Turn Release 1 from a strong leasing/billing backend into a **complete property-operations platform**.

Release 2 should answer:

> Can a property manager operate an occupied building month after month, handle utilities, inspections, maintenance expenses, renewals, move-outs, deposits, agents, and integrated payments without maintaining parallel spreadsheets?

Recommended duration:

**8–10 weeks**

Recommended release target:

```text
v2.0.0
```

---

# 3. Release 2 Scope

Release 2 contains:

- utilities
- meters
- utility apportionment
- inspections
- move-in condition evidence expansion
- move-out workflow
- security deposit settlement
- lease renewal
- rent increase / negotiation
- property expenses
- owner statements
- agents / brokers
- commission accounting
- online payment provider integration
- payment webhook reconciliation
- WhatsApp integration
- communications timeline
- financial reconciliation
- operational automation
- advanced reports
- production hardening

---

# 4. Release 2 Schedule Overview

| Phase | Duration | Outcome |
|---|---:|---|
| R2.0 Architecture Review | 2–3 days | Freeze R2 domain extensions |
| R2.1 Utilities & Metering | Week 1 | Utility system of record |
| R2.2 Inspections | Week 2 | Move-in/out evidence |
| R2.3 Move-Out & Deposit Settlement | Week 3 | Complete occupancy lifecycle |
| R2.4 Renewals & Rent Changes | Week 4 | Controlled lease continuation |
| R2.5 Expenses & Owner Accounting | Week 5 | Property-level profitability |
| R2.6 Agents & Commission | Week 6 | Broker operations |
| R2.7 Online Payments & Reconciliation | Week 7 | Provider-backed collections |
| R2.8 WhatsApp & Communications | Week 8 | Bangladesh-native communication |
| R2.9 Advanced Reports & Automation | Week 9 | Operational intelligence |
| R2.10 Stabilization | Week 10 | Production-ready R2 |

---

# 5. R2.0 — Architecture Review

Before implementation:

- [x] Review R1 schema against production/pilot findings
- [x] Review real tenant/payment/lease edge cases
- [x] Confirm utility allocation domain
- [x] Confirm inspection evidence model
- [x] Confirm move-out state machine
- [x] Confirm security deposit ledger rules
- [x] Confirm renewal/versioning strategy
- [x] Confirm expense approval rules
- [x] Confirm agent attribution model
- [x] Confirm payment provider abstraction
- [x] Confirm webhook architecture
- [x] Confirm reconciliation strategy
- [x] Update context map
- [x] Update event catalog
- [x] Update permission matrix
- [x] Update audit event catalog
- [x] Replay full migration history from empty DB

### Exit Gate

Do not start R2 development until:

```text
Lease lifecycle
Finance model
Deposit model
Property hierarchy
Authorization
```

are stable enough that R2 does not require destructive redesign.

---

# 6. R2.1 — Utilities & Metering

## Week 1

### Utility Domain

Implement:

- [x] `UtilityType`
- [x] `UtilityAccount`
- [x] `Meter`
- [x] `MeterReading`
- [x] `UtilityBill`
- [x] `UtilityAllocation`
- [x] `UtilityCharge`

Supported utilities:

```text
ELECTRICITY
WATER
GAS
GENERATOR
INTERNET
COMMON_AREA
OTHER
```

### Billing Strategies

Support:

```text
TENANT_DIRECT
OWNER_INCLUDED
FIXED_CHARGE
INDIVIDUAL_METER
SHARED_METER
MANUAL_ALLOCATION
```

### Shared Allocation Methods

- [x] equal split
- [x] occupant count
- [x] floor area
- [x] configured percentage
- [x] submeter consumption
- [x] manual allocation

### Meter Reading

Capture:

- [x] previous reading
- [x] current reading
- [x] consumption
- [x] date
- [x] reader
- [x] photo evidence
- [x] notes

### Validation

- [x] current reading cannot be lower unless meter reset/replacement
- [x] duplicate reading period prevented
- [x] meter must belong to authorized property
- [x] allocation total must equal bill total within rounding rule
- [x] allocation cannot post twice

### Invoice Integration

```text
UtilityBill
   ↓
UtilityAllocation
   ↓
InvoiceLine
   ↓
Tenant Ledger
```

- [x] post utility charges to invoice
- [x] late input handling
- [x] correction via adjustment, not silent mutation

### Tests

- [x] equal split
- [x] occupancy split
- [x] percentage split totals 100%
- [x] rounding
- [x] missing reading
- [x] duplicate allocation
- [x] allocation reversal

### Exit Gate

A building with shared electricity/water can produce deterministic, auditable unit-level charges.

---

# 7. R2.2 — Inspection System

## Week 2

### Models

- [x] `Inspection`
- [x] `InspectionSection`
- [x] `InspectionItem`
- [x] `InspectionMedia`
- [x] `InspectionAcknowledgement`

Inspection types:

```text
MOVE_IN
MOVE_OUT
PERIODIC
MAINTENANCE
SAFETY
CUSTOM
```

Condition states:

```text
EXCELLENT
GOOD
FAIR
DAMAGED
MISSING
NOT_APPLICABLE
```

### Template System

- [x] inspection template
- [x] reusable sections
- [x] property-specific templates
- [x] unit-type templates

### Evidence

- [x] photos
- [x] videos where supported
- [x] timestamps
- [x] uploader identity
- [x] optional geo metadata
- [x] immutable evidence hash/reference

### Acknowledgement

- [x] tenant acknowledgment
- [x] manager acknowledgment
- [x] disagreement notes
- [x] signed/confirmed timestamp

### Comparison

- [x] compare move-in vs move-out
- [x] identify changed condition
- [x] create damage candidates
- [x] attach maintenance estimate

### Security

- [x] private storage
- [x] signed URLs
- [x] authorization by lease/property
- [x] download audit

---

# 8. R2.3 — Move-Out & Deposit Settlement

## Week 3

### Move-Out State Machine

```text
NOTICE_RECEIVED
→ NOTICE_ACCEPTED
→ MOVE_OUT_SCHEDULED
→ FINAL_BILLING
→ INSPECTION_PENDING
→ INSPECTION_COMPLETE
→ SETTLEMENT_PENDING
→ SETTLED
→ CLOSED
```

Alternative states:

```text
DISPUTED
CANCELLED
ABANDONED
```

### Workflow

- [x] tenant notice
- [x] owner notice
- [x] planned move-out date
- [x] final meter readings
- [x] final utility calculation
- [x] outstanding invoice calculation
- [x] move-out inspection
- [x] damage assessment
- [x] key return
- [x] deposit settlement
- [x] final statement
- [x] unit state update

### Deposit Settlement

Never mutate original deposit receipt.

Create transactions:

```text
DEPOSIT_RECEIVED
DEDUCTION_DAMAGE
DEDUCTION_UTILITY
DEDUCTION_RENT
DEDUCTION_OTHER
REFUND
ADJUSTMENT
```

### Invariants

- [x] deductions cannot exceed available deposit without creating receivable
- [x] refund cannot exceed remaining balance
- [x] refund requires authorized approval
- [x] lease close requires settlement decision
- [x] unit cannot become AVAILABLE before required close steps

### Dispute

- [x] disputed deduction
- [x] evidence link
- [x] resolution note
- [x] adjustment transaction
- [x] audit trail

### Exit Gate

System can explain exactly:

```text
Deposit received
- deductions
- outstanding liabilities
= refund/payable
```

---

# 9. R2.4 — Renewal, Rent Increase & Negotiation

## Week 4

### Renewal

- [x] lease expiry scheduler
- [x] 120/90/60/30/15/7 day reminders
- [x] renewal eligibility
- [x] renewal offer
- [x] renewal decision
- [x] create successor lease

Never overwrite historical lease.

Use:

```text
newLease.renewedFromLeaseId
```

### Rent Change

Models:

- [x] `RentProposal`
- [x] `RentProposalVersion`
- [x] `RentChangeNotice`

Workflow:

```text
OWNER_PROPOSED
→ TENANT_REVIEW
→ COUNTERED
→ ACCEPTED
→ REJECTED
→ EXPIRED
```

### Configuration

- [x] notice period configurable
- [x] legal/policy rules configurable
- [x] no hardcoded legal assumptions in domain service
- [x] supporting notice document

### Audit

- [x] old rent
- [x] proposed rent
- [x] counter amount
- [x] accepted amount
- [x] effective date
- [x] actors
- [x] timestamps

---

# 10. R2.5 — Expenses & Owner Accounting

## Week 5

### Expense Domain

- [x] `Expense`
- [x] `ExpenseCategory`
- [x] `ExpenseAllocation`
- [x] `ExpenseApproval`
- [x] receipt/document link

Categories:

```text
MAINTENANCE
SECURITY
CLEANING
GENERATOR
LIFT
COMMON_UTILITY
STAFF
PROPERTY_TAX
MANAGEMENT
LEGAL
OTHER
```

### Approval

Support:

```text
DRAFT
SUBMITTED
APPROVED
REJECTED
PAID
VOID
```

### Allocation

Expense may belong to:

- [x] organization
- [x] property
- [x] building
- [x] unit
- [x] maintenance request
- [x] owner

### Owner Statement

Build:

```text
Rent collected
+ other income
- refunds
- maintenance
- operating expenses
- management fee
- agent commission
--------------------------------
Owner net position
```

### Reports

- [x] property P&L
- [x] owner statement
- [x] expense by property
- [x] expense by category
- [x] maintenance expense
- [x] monthly income vs expense

### Financial Review

Ensure expenses interact correctly with ledger/accounting model.

---

# 11. R2.6 — Agent / Broker Operations

## Week 6

### Models

- [x] `AgentProfile`
- [x] `Agency`
- [x] `LeadAttribution`
- [x] `PropertyAgent`
- [x] `CommissionRule`
- [x] `Commission`
- [x] `CommissionPayment`

### Attribution

Track:

```text
Lead
→ source agent
→ viewing
→ application
→ lease
```

Attribution must not be editable silently after lease execution.

### Commission Lifecycle

```text
PENDING
EARNED
APPROVAL_PENDING
APPROVED
PAID
DISPUTED
CANCELLED
```

### Commission Rules

Support:

- [x] fixed amount
- [x] percentage of rent
- [x] number of months' rent
- [x] manual amount
- [x] custom per-property rule

### Controls

- [x] one commission earning event per qualifying lease
- [x] prevent duplicate payout
- [x] reversal workflow
- [x] dispute workflow
- [x] audit

### Reports

- [x] commission payable
- [x] commission paid
- [x] agent conversion
- [x] leads by agent
- [x] lease value by agent

---

# 12. R2.7 — Online Payments & Reconciliation

## Week 7

### Provider Contract

Implement stable port:

```ts
interface PaymentProvider {
  initiatePayment(input: InitiatePaymentInput): Promise<PaymentIntent>;
  verifyPayment(reference: string): Promise<ProviderPaymentStatus>;
  refund(input: RefundInput): Promise<RefundResult>;
  parseWebhook(input: WebhookInput): Promise<NormalizedPaymentEvent>;
}
```

### Adapters

Initial:

- [x] bKash
- [x] optional gateway provider
- [x] Nagad interface placeholder
- [x] manual payment adapter

### Payment Intent

- [x] payment intent
- [x] expiresAt
- [x] provider reference
- [x] internal idempotency key
- [x] expected amount
- [x] currency
- [x] payer
- [x] invoice allocation intent

### Webhooks

Pipeline:

```text
Provider
→ webhook controller
→ signature/auth verification
→ raw event store
→ idempotency check
→ normalization
→ payment service
→ allocation
→ ledger
→ internal event
```

### Required Tables/Concepts

- [x] external payment event
- [x] processed status
- [x] provider reference unique constraint
- [x] reconciliation finding
- [x] reconciliation run

### Reconciliation

Do not depend only on webhook.

- [x] scheduled provider reconciliation
- [x] missing payment detection
- [x] amount mismatch
- [x] status mismatch
- [x] duplicate provider reference
- [x] unresolved finding queue

### Failure Scenarios

Test:

- [x] webhook twice
- [x] webhook before redirect
- [x] redirect before webhook
- [x] provider timeout
- [x] provider success + local DB failure
- [x] local success + response timeout
- [x] stale webhook
- [x] wrong amount
- [x] wrong currency
- [x] refund callback

### Exit Gate

No payment provider event can create duplicate money.

---

# 13. R2.8 — WhatsApp & Communications

## Week 8

### Communication Domain

- [x] `Conversation`
- [x] `Communication`
- [x] `MessageTemplate`
- [x] `MessageDelivery`
- [x] external message ID
- [x] direction
- [x] channel

Channels:

```text
IN_APP
EMAIL
SMS
WHATSAPP
PHONE_LOG
MANUAL_NOTE
```

### WhatsApp Adapter

- [x] provider interface
- [x] outbound template message
- [x] webhook receiver
- [x] delivery status
- [x] inbound message
- [x] media attachment
- [x] duplicate webhook protection

### Use Cases

- [x] rent reminder
- [x] invoice issued
- [x] payment confirmation
- [x] maintenance created
- [x] technician assigned
- [x] lease expiry
- [x] renewal offer
- [x] tenant notice

### Maintenance Inbound

Future-safe workflow:

```text
Inbound WhatsApp
→ identify tenant
→ parse context
→ create communication
→ optionally create maintenance draft
→ staff confirms
```

Do not allow uncontrolled inbound text to directly perform sensitive state mutations.

---

# 14. R2.9 — Advanced Reporting & Automation

## Week 9

### Reports

- [x] utility recovery
- [x] expense report
- [x] owner statement
- [x] deposit liability
- [x] move-out settlement
- [x] agent commission
- [x] payment reconciliation
- [x] lease renewal pipeline
- [x] maintenance SLA
- [x] property profitability
- [x] occupancy trend

### Export

- [x] asynchronous export jobs
- [x] CSV
- [x] PDF where required
- [x] temporary signed download
- [x] expiry
- [x] export audit

### Automation Rules

Start conservative.

Implement system rules, not a fully generic workflow engine yet.

Examples:

```text
invoice due in 3 days → reminder
invoice overdue 7 days → escalation
lease expires in 60 days → renewal task
maintenance emergency → manager alert
payment mismatch → finance alert
```

Models:

- [x] automation definition
- [x] trigger
- [x] action
- [x] enabled
- [x] execution log

---

# 15. R2.10 — Stabilization & Production Gate

## Week 10

### Full Regression

- [x] R1 flows pass
- [x] R2 flows pass
- [x] finance regression
- [x] permissions regression
- [x] migration replay
- [x] seed validation
- [x] queue retry validation
- [x] webhook replay validation

### Load Scenarios

Test:

```text
10 organizations
100 properties
5,000 units
10,000 tenants
100,000 invoices
250,000 ledger entries
```

Not necessarily production target—use enough volume to reveal bad query patterns.

### Release Gate

- [x] no unresolved critical security finding
- [x] no unresolved financial mismatch
- [x] zero known cross-tenant data leaks
- [x] DB restore verified
- [x] payment reconciliation verified
- [x] background job dashboards operational
- [x] runbooks updated
- [x] API docs updated
- [x] architecture docs updated

---

# 16. Release 2 Acceptance Scenarios

## Scenario 1 — Shared Utility

```text
Building receives electricity bill
→ meter/readings entered
→ allocation calculated
→ tenant invoices updated
→ total allocations equal source bill
```

## Scenario 2 — Move-Out

```text
Tenant gives notice
→ final billing
→ move-out inspection
→ damage deduction
→ deposit settlement
→ refund
→ lease closed
→ unit available
```

## Scenario 3 — Renewal

```text
Lease expiring
→ offer
→ counter
→ accepted
→ successor lease
→ old lease retained
```

## Scenario 4 — Online Payment

```text
Tenant initiates payment
→ provider
→ webhook
→ idempotent payment
→ invoice allocation
→ ledger
→ receipt
```

## Scenario 5 — Agent

```text
Agent creates/owns attribution
→ lead converts
→ lease activated
→ commission earned
→ approved
→ paid
```

---

# 17. Release 3 — Objective

## Release 3 Goal

Transform Ferio Rental from a strong property-management product into a **scalable multi-organization property operating platform / SaaS ecosystem**.

Release 3 focuses on:

- enterprise account structures
- NRB ownership
- owner self-service
- tenant self-service
- mobile
- subscription billing
- external API
- outbound/inbound webhooks
- integrations
- configurable automation
- advanced analytics
- advanced accounting
- portfolio-level controls
- platform administration
- higher availability
- compliance tooling
- service extraction where justified

Recommended duration:

**10–14 weeks**

Target:

```text
v3.0.0
```

---

# 18. Release 3 Schedule Overview

| Phase | Duration | Outcome |
|---|---:|---|
| R3.0 Architecture & Scale Review | Week 1 | Scale boundaries frozen |
| R3.1 Owner / NRB Portal | Week 2 | Remote ownership operations |
| R3.2 Tenant PWA / Self-Service APIs | Week 3 | Tenant self-service |
| R3.3 Mobile Backend Readiness | Week 4 | React Native-ready APIs |
| R3.4 SaaS Subscription & Entitlements | Week 5 | Monetizable platform |
| R3.5 Enterprise API & Webhooks | Week 6 | External integration layer |
| R3.6 Advanced Automation | Week 7 | Workflow automation |
| R3.7 Advanced Accounting / Owner Settlement | Weeks 8–9 | Financial operations depth |
| R3.8 Analytics & Data Platform | Week 10 | Decision intelligence |
| R3.9 Platform Administration | Week 11 | SaaS operations |
| R3.10 Reliability / Scale | Weeks 12–13 | Production scale hardening |
| R3.11 Final Pilot / Migration | Week 14 | Enterprise-ready release |

---

# 19. R3.0 — Architecture & Scale Review

## Week 1

Review actual usage before adding scale complexity.

### Review

- [x] organization counts
- [x] largest organization size
- [x] DB growth rate
- [x] top 20 slow queries
- [x] Redis usage
- [x] queue throughput
- [x] notification volume
- [x] payment volume
- [x] file-storage growth
- [x] report latency
- [x] webhook load
- [x] peak API concurrency

### Architecture Decisions

Decide whether any module truly requires extraction.

Candidates only if justified:

```text
notifications
reports
payments
document processing
```

Default remains modular monolith.

### Data

- [x] archive strategy
- [x] retention strategy
- [x] partitioning review
- [x] index health
- [x] read replica need
- [x] analytics workload isolation

---

# 20. R3.1 — Owner / NRB Portal

## Week 2

### Owner Access

- [x] owner login
- [x] portfolio access
- [x] property summary
- [x] unit occupancy
- [x] collection summary
- [x] expenses
- [x] maintenance
- [x] statements
- [x] documents

### Delegation

Enhance:

- [x] family representative
- [x] property manager
- [x] accountant
- [x] time-bound permissions
- [x] per-property delegation
- [x] financial approval limits

### NRB Features

- [x] preferred reporting currency
- [x] BDT as accounting currency
- [x] display-only currency conversion
- [x] FX rate source abstraction
- [x] timezone preferences
- [x] remote approvals
- [x] remote document access

Avoid treating converted currency as ledger truth.

Ledger remains in transaction/accounting currency.

---

# 21. R3.2 — Tenant PWA & Self-Service API

## Week 3

### Tenant APIs

- [x] dashboard
- [x] lease
- [x] invoices
- [x] payments
- [x] receipts
- [x] ledger
- [x] maintenance
- [x] documents
- [x] notices
- [x] profile

### Self-Service

- [x] update allowed contact fields
- [x] payment initiation
- [x] maintenance creation
- [x] maintenance media upload
- [x] notice submission
- [x] document acknowledgment

### Security

Tenant APIs must never expose:

- owner-private documents
- other tenants
- internal staff notes
- internal financial records
- vendor-private information

### PWA Support

- [x] API caching rules
- [x] offline-safe read strategy
- [x] resumable uploads if needed
- [x] push notification tokens
- [x] device registration

---

# 22. R3.3 — React Native / Mobile Backend Readiness

## Week 4

Backend should not create a separate mobile business model.

### Mobile Requirements

- [x] device registration
- [x] refresh-session strategy
- [x] push tokens
- [x] deep-link payloads
- [x] mobile OAuth contract
- [x] upload APIs
- [x] paginated activity feeds
- [x] lightweight dashboard endpoints

### BFF Decision

Evaluate:

```text
React Native → NestJS directly
```

versus:

```text
React Native → Mobile BFF → NestJS
```

Use BFF only if aggregation/auth/client-specific transformations justify it.

### API Contracts

- [x] stable versioning
- [x] backward compatibility policy
- [x] mobile minimum-supported API version
- [x] deprecated endpoint policy

---

# 23. R3.4 — SaaS Subscription & Entitlements

## Week 5

### Subscription Domain

- [x] `Plan`
- [x] `PlanFeature`
- [x] `Subscription`
- [x] `Entitlement`
- [x] `UsageCounter`
- [x] `BillingPeriod`

Plan examples:

```text
FREE
STARTER
PRO
BUSINESS
ENTERPRISE
```

### Entitlements

Examples:

```text
maxProperties
maxUnits
maxStaff
advancedReports
whatsappAutomation
ownerPortal
apiAccess
customRoles
```

Do not scatter:

```ts
if (plan === 'PRO')
```

through code.

Use entitlement service.

### Subscription Lifecycle

```text
TRIAL
ACTIVE
PAST_DUE
SUSPENDED
CANCELLED
EXPIRED
```

### Graceful Restriction

If plan limit exceeded:

- do not destroy data
- restrict new resource creation
- preserve read/export access according to policy

---

# 24. R3.5 — Enterprise API & Webhooks

## Week 6

### API Credentials

- [x] API client
- [x] API key / OAuth client credentials
- [x] scopes
- [x] organization ownership
- [x] rotation
- [x] revoke
- [x] last-used metadata

### External API

Initial resources:

```text
properties
units
tenants
leases
invoices
payments
maintenance
```

### Webhook Subscription

- [x] endpoint
- [x] subscribed events
- [x] secret
- [x] active state
- [x] failure counter

Events:

```text
lease.activated
invoice.issued
invoice.paid
payment.received
maintenance.created
maintenance.closed
```

### Delivery

- [x] signed webhook
- [x] unique event ID
- [x] retries
- [x] exponential backoff
- [x] delivery log
- [x] replay endpoint
- [x] automatic disable threshold

### Security

- [x] scopes
- [x] rate limits
- [x] secret rotation
- [x] payload signature
- [x] no internal IDs exposed unnecessarily

---

# 25. R3.6 — Advanced Automation Engine

## Week 7

Now a generic automation layer may be justified.

### Model

```text
Automation
Trigger
Condition
Action
Execution
```

### Trigger Types

```text
EVENT
SCHEDULE
DATE_RELATIVE
THRESHOLD
```

Examples:

```text
invoice.overdue
lease.expiring
maintenance.opened
payment.failed
unit.vacant_for_days
```

### Conditions

Examples:

```text
propertyId
amount > X
daysOverdue > X
tenant segment
lease status
```

### Actions

```text
send notification
create task
assign staff
send WhatsApp
send email
create escalation
invoke webhook
```

### Safeguards

- [x] execution idempotency
- [x] recursion protection
- [x] maximum actions/run
- [x] disabled automation safety
- [x] audit
- [x] dry-run/test mode
- [x] execution history

Do not allow arbitrary user code execution.

---

# 26. R3.7 — Advanced Accounting & Owner Settlement

## Weeks 8–9

### Accounting Expansion

Add only after ledger is stable.

- [x] chart of accounts abstraction
- [x] property income accounts
- [x] receivable
- [x] tenant deposit liability
- [x] vendor payable
- [x] owner payable
- [x] management fee income
- [x] commission payable

### Owner Settlement

Workflow:

```text
Collections
- property expenses
- refunds
- commission
- management fee
= owner payable
```

Models:

- [x] `OwnerStatement`
- [x] `OwnerSettlement`
- [x] `OwnerSettlementLine`
- [x] `OwnerPayout`

Status:

```text
DRAFT
REVIEW
APPROVED
PAID
RECONCILED
VOID
```

### Controls

- [x] maker/checker
- [x] payout approval
- [x] bank reference
- [x] immutable statement snapshot
- [x] payout cannot exceed payable
- [x] reversal workflow

### Period Close

Optional:

- [x] monthly property close
- [x] prevent silent mutation of closed period
- [x] adjustment into subsequent period

---

# 27. R3.8 — Analytics & Data Platform

## Week 10

Do not overload OLTP queries indefinitely.

### Analytics Layer

Start with:

```text
PostgreSQL read model/materialized views
```

before introducing a warehouse.

### Metrics

#### Leasing

- [x] lead conversion
- [x] viewing conversion
- [x] approval rate
- [x] time-to-lease
- [x] vacancy days

#### Financial

- [x] collection rate
- [x] arrears
- [x] aging
- [x] income/unit
- [x] expense/unit
- [x] NOI
- [x] deposit liability

#### Operations

- [x] maintenance response
- [x] maintenance resolution
- [x] vendor performance
- [x] recurring issue rate

#### Portfolio

- [x] occupancy
- [x] vacancy
- [x] lease expiry concentration
- [x] property profitability

### Snapshots

For historical dashboard accuracy:

- [x] daily KPI snapshot
- [x] monthly portfolio snapshot
- [x] immutable period metrics where needed

---

# 28. R3.9 — Platform Administration

## Week 11

Ferio super-admin functionality.

### Platform Admin

- [x] organization directory
- [x] subscription status
- [x] account suspension
- [x] impersonation/support access policy
- [x] feature flags
- [x] usage metrics
- [x] integration health
- [x] failed webhooks
- [x] failed jobs
- [x] system notices

### Support Access

If impersonation is supported:

- [x] explicit permission
- [x] reason required
- [x] short-lived session
- [x] owner/admin notification policy
- [x] complete audit
- [x] sensitive actions disabled or separately approved

### Feature Flags

- [x] platform
- [x] plan
- [x] organization
- [x] rollout percentage if needed

---

# 29. R3.10 — Reliability & Scale

## Weeks 12–13

### Database

- [x] slow query review
- [x] connection pooling
- [x] indexes
- [x] vacuum/analyze monitoring
- [x] large-table strategy
- [x] partitioning only if measured need
- [x] read replica evaluation

### Redis

- [x] memory policy
- [x] key expiration policy
- [x] queue isolation
- [x] cache invalidation review
- [x] failover strategy

### Queues

- [x] queue concurrency
- [x] retry policies
- [x] dead-letter workflows
- [x] poison job controls
- [x] job observability

### API

- [x] rate limiting by plan/client
- [x] endpoint latency budgets
- [x] pagination enforcement
- [x] export size limits
- [x] request size limits

### Reliability Targets

Proposed:

```text
API availability       ≥ 99.9%
standard API p95       < 400 ms
critical write p95     < 700 ms
RPO                    <= 1 hour
RTO                    <= 2 hours
```

Actual targets should match business tier and infrastructure budget.

### Disaster Recovery

- [x] automated backups
- [x] point-in-time recovery
- [x] restore drill
- [x] Redis-loss behavior documented
- [x] object-store recovery
- [x] credential recovery
- [x] DNS / edge runbook

---

# 30. R3.11 — Enterprise Pilot / Migration

## Week 14

Pilot with larger operational data.

### Pilot Profile

Target test organization:

```text
20+ properties
500–2,000 units
2,000+ tenants/history
multiple property managers
accounting staff
leasing staff
maintenance staff
owners
agents
```

### Validate

- [x] access scopes
- [x] report performance
- [x] bulk imports
- [x] exports
- [x] payment load
- [x] notification load
- [x] owner statements
- [x] subscription entitlements
- [x] API rate limiting
- [x] webhook replay
- [x] mobile session lifecycle

### Release Gate

- [x] enterprise migration plan
- [x] onboarding runbook
- [x] billing runbook
- [x] incident response
- [x] support escalation
- [x] SLA/SLO documentation
- [x] data export
- [x] data deletion policy
- [x] customer offboarding procedure

---

# 31. Release 3 Acceptance Scenarios

## Scenario A — NRB Owner

```text
Owner abroad
→ login
→ see portfolio
→ see BDT ledger
→ see display currency
→ review expenses
→ approve settlement
→ delegated local manager remains scoped
```

## Scenario B — SaaS Plan

```text
Organization on Starter
→ reaches unit limit
→ existing data remains available
→ creation blocked
→ upgrade
→ entitlement refreshed
→ creation allowed
```

## Scenario C — External Client

```text
Enterprise client
→ API credential
→ calls invoices API
→ scoped access
→ rate limit
→ receives webhook when payment posted
```

## Scenario D — Automation

```text
Invoice overdue > 7 days
→ rule matches
→ task created
→ WhatsApp reminder queued
→ execution audited
→ duplicate event does not duplicate action
```

## Scenario E — Owner Settlement

```text
month closes
→ collections
→ expenses
→ fees
→ owner payable
→ approval
→ payout
→ reconciliation
```

---

# 32. Release 2 & 3 Migration Strategy

Every schema change must follow:

```text
Design
→ migration SQL review
→ local replay
→ CI replay
→ staging migration
→ data validation
→ production rollout
```

For high-volume/destructive changes:

```text
Expand
→ backfill
→ switch reads/writes
→ verify
→ contract/remove old schema
```

Avoid:

```text
rename/drop/add in one risky production migration
```

Use compatibility windows.

---

# 33. Data Migration / Import Capabilities

By Release 3, implement structured imports for onboarding existing property managers.

### Imports

- [x] properties
- [x] buildings
- [x] units
- [x] owners
- [x] tenants
- [x] leases
- [x] opening balances
- [x] deposits

### Import Architecture

```text
Upload
→ parse
→ validate
→ preview
→ errors
→ approval
→ background import
→ result report
```

Never directly insert spreadsheet rows into production tables without validation.

### Import Requirements

- [x] idempotency
- [x] row-level errors
- [x] dry run
- [x] resumability
- [x] source evidence
- [x] audit
- [x] rollback strategy where possible

---

# 34. Release 2 Permission Extensions

Add permissions such as:

```text
utility.read
utility.manage
meter.read
meter.record

inspection.read
inspection.manage

moveout.initiate
moveout.approve

deposit.read
deposit.adjust
deposit.refund

expense.read
expense.create
expense.approve

agent.read
agent.manage
commission.read
commission.approve
commission.pay

payment.online.manage
reconciliation.read
reconciliation.resolve
```

---

# 35. Release 3 Permission Extensions

```text
owner.statement.read
owner.settlement.create
owner.settlement.approve
owner.payout.execute

subscription.read
subscription.manage

api_client.read
api_client.manage

webhook.read
webhook.manage
webhook.replay

automation.read
automation.manage

platform.organization.read
platform.organization.suspend
platform.feature_flag.manage
platform.support_access
```

Each permission must be evaluated with scope.

---

# 36. Release 2 Event Catalog Extensions

```text
utility.bill_created
utility.allocated
meter.reading_recorded

inspection.started
inspection.completed

moveout.notice_received
moveout.completed

deposit.deduction_created
deposit.refunded

lease.renewal_offered
lease.renewed
rent.proposed
rent.changed

expense.submitted
expense.approved
expense.paid

agent.attributed
commission.earned
commission.paid

payment.intent_created
payment.provider_confirmed
payment.reconciled

communication.received
communication.delivered
```

---

# 37. Release 3 Event Catalog Extensions

```text
owner.statement_generated
owner.settlement_approved
owner.payout_completed

subscription.started
subscription.changed
subscription.suspended

api_client.created
api_client.revoked

webhook.subscription_created
webhook.delivery_failed

automation.triggered
automation.completed
automation.failed

organization.suspended
feature_flag.changed
```

---

# 38. Release 2 Background Jobs

```text
GenerateUtilityCharges
DetectMissingMeterReadings
LeaseExpiryScan
RenewalReminder
MoveOutReminder
DepositSettlementReminder
PaymentProviderReconciliation
CommissionAccrual
OwnerStatementGenerate
WhatsAppDispatch
CommunicationDeliveryReconcile
```

---

# 39. Release 3 Background Jobs

```text
SubscriptionUsageRollup
SubscriptionRenewal
EntitlementRefresh
OwnerSettlementGenerate
OwnerPayoutReconcile
WebhookDispatch
WebhookRetry
AutomationEvaluate
AutomationExecute
DailyAnalyticsSnapshot
MonthlyAnalyticsSnapshot
DataRetentionSweep
ArchiveOldOperationalData
```

---

# 40. Release 2 Security Review

Before R2 production:

- [x] payment webhook authenticity
- [x] provider secret rotation
- [x] deposit refund permission
- [x] expense approval separation
- [x] commission payout separation
- [x] inspection media access
- [x] tenant move-out authorization
- [x] owner statement access
- [x] WhatsApp webhook validation
- [x] PII in communications reviewed

---

# 41. Release 3 Security Review

Before R3 production:

- [x] API key hashing/storage
- [x] API key rotation
- [x] API scope enforcement
- [x] webhook signing
- [x] platform admin isolation
- [x] support impersonation controls
- [x] subscription bypass protection
- [x] owner payout controls
- [x] automation privilege controls
- [x] tenant mobile session security
- [x] mobile deep-link validation
- [x] external integration threat model

---

# 42. Release 2 Testing Targets

Minimum critical suites:

```text
utilities
metering
utility allocation
inspection
move-out
deposit settlement
renewal
rent proposal
expenses
commissions
payment provider
webhook
reconciliation
WhatsApp
```

Test at least:

- happy paths
- invalid state transitions
- concurrency
- cross-tenant access
- permissions
- duplicate webhooks
- retries
- financial rounding
- reversals

---

# 43. Release 3 Testing Targets

Additional:

```text
entitlements
subscriptions
owner settlement
owner payout
API clients
API scopes
webhook subscriptions
automation engine
platform administration
tenant PWA
mobile sessions
analytics snapshots
import pipeline
```

---

# 44. Performance Budget by Release 3

Guideline:

### Standard CRUD

```text
p95 < 300–400 ms
```

### Complex dashboard

```text
p95 < 1 s
```

### Large reports

Must be async.

```text
request
→ report job
→ status polling / notification
→ download
```

### Search

If PostgreSQL search becomes demonstrably insufficient:

```text
introduce Typesense / Elasticsearch
```

only after profiling.

---

# 45. Service Extraction Decision Framework

Do not extract a service because a module “looks big.”

Extract only when one or more are true:

- independent scaling requirement
- separate reliability boundary
- separate deployment cadence
- separate data ownership justified
- third-party instability needs isolation
- workload is operationally distinct
- team ownership requires boundary

Likely candidates later:

```text
notification service
reporting worker
document processing
payment integration service
```

Not automatically:

```text
tenant service
property service
lease service
```

---

# 46. Release 2 Definition of Done

Release 2 is complete only when the platform can execute:

```text
occupied property
→ monthly utilities
→ rent invoice
→ digital/manual payment
→ maintenance
→ expense
→ lease renewal OR move-out
→ deposit settlement
→ owner statement
```

without external spreadsheets being required for accounting truth.

---

# 47. Release 3 Definition of Done

Release 3 is complete only when:

- [x] multiple organizations can operate independently at scale
- [x] property manager SaaS entitlements work
- [x] owner self-service works
- [x] tenant self-service works
- [x] mobile API is stable
- [x] external API is secured
- [x] outbound webhooks are reliable
- [x] automation is idempotent and auditable
- [x] owner settlement is financially traceable
- [x] platform administrators can operate SaaS safely
- [x] monitoring supports meaningful SLOs
- [x] backup/restore has been tested
- [x] enterprise onboarding/import is repeatable

---

# 48. Recommended Documentation Before Release 2

Complete/update:

```text
16-utilities-domain.md
17-inspection-domain.md
18-moveout-and-deposit-settlement.md
19-renewal-and-rent-change-state-machine.md
20-expense-accounting.md
21-agent-commission-design.md
22-payment-provider-architecture.md
23-payment-reconciliation.md
24-whatsapp-integration.md
```

---

# 49. Recommended Documentation Before Release 3

Create:

```text
25-saas-subscription-entitlements.md
26-owner-settlement-accounting.md
27-public-api-specification.md
28-webhook-contract.md
29-automation-engine.md
30-mobile-auth-and-session-contract.md
31-platform-admin-security.md
32-analytics-architecture.md
33-enterprise-import-framework.md
34-data-retention-archival.md
35-disaster-recovery-runbook.md
36-slo-sla-observability.md
```

---

# 50. Final Architecture Direction

By the end of Release 3, Ferio Rental should look conceptually like:

```text
                         FERIO RENTAL PLATFORM

                              PLATFORM IAM
                                  │
                     ┌────────────┴────────────┐
                     │                         │
                ORGANIZATIONS              PLATFORM ADMIN
                     │
       ┌─────────────┼──────────────────┐
       │             │                  │
    PROPERTY       LEASING            PEOPLE / CRM
       │             │                  │
       └──────┬──────┴──────────┬───────┘
              │                 │
          OPERATIONS         FINANCIAL CORE
              │                 │
      ┌───────┼──────┐     ┌────┼────────────┐
      │       │      │     │    │            │
 Utilities Inspection Maint  Billing Payments Ledger
                              │
                    ┌─────────┼──────────┐
                    │         │          │
                 Deposit   Expense    Settlement
                    │
         ┌──────────┴───────────────┐
         │                          │
   COMMUNICATION                AUTOMATION
         │                          │
 Email / SMS / WA / Push       Rules / Jobs
         │                          │
         └────────────┬─────────────┘
                      │
              API / WEBHOOK LAYER
                      │
          ┌───────────┼──────────────┐
          │           │              │
      Admin Web   Tenant PWA    React Native
          │
       Owner Portal
```

The system should still remain understandable as a modular monolith even at this stage.

The architecture is successful if every operational action can be answered with:

```text
Who performed it?
For which organization?
Against which property/lease/account?
Was the actor allowed?
Was the state transition valid?
Was the financial impact recorded?
Was it idempotent?
Was it audited?
Can it be reconciled?
Can it be reproduced from history?
```

That is the target maturity level for Release 2 and Release 3.
