Yes. I’d treat this as a **new domain platform**, not as “Ferio e-commerce with property tables.” Your existing Ferio architecture gives you reusable engineering patterns—NestJS, Prisma/PostgreSQL, Redis, auth/RBAC, audit logging, notifications, payments/webhooks, admin UX—but the rental domain needs its own bounded contexts and lifecycle.

The source document is directionally strong: it correctly identifies that Bangladesh rental operations involve owners, renters, agents, managers/family delegates, guarantors and maintenance crews rather than a simple owner→tenant relationship.  It also calls for flexible billing, guarantors, offline payments, utilities and maintenance rather than assuming a purely digital Western rental model. 

Below is the PRD I would put in front of a senior backend team.

# FERIO RENTAL

## Property Operations, Leasing & Rental CRM Platform

**Document:** Product Requirements Document
**Version:** 1.0 Architecture Baseline
**Market:** Bangladesh-first
**Product Type:** Multi-tenant SaaS / Property Management CRM
**Primary Interface:** Web Admin / Operations Portal
**Secondary Interface:** Tenant & Owner Portal/PWA
**Backend:** NestJS
**Persistence:** PostgreSQL + Prisma
**Cache / Jobs / Realtime:** Redis
**Architecture direction:** Modular Monolith → service extraction where justified

---

# 1. Product Vision

Ferio Rental will be a **property operations system of record** for landlords, property-management companies and real-estate operators.

It should manage the complete operational lifecycle:

**Property acquisition → inventory → vacancy → lead → viewing → application → verification → negotiation → lease → move-in → recurring billing → collection → utilities → maintenance → renewal → move-out → deposit settlement → vacancy**

The platform is therefore not simply:

> “software for collecting rent.”

It is closer to:

> **An operating system for long-term rental property management.**

The product should replace fragmented combinations of Excel sheets, notebooks, WhatsApp conversations, paper agreements, receipt books and informal verbal records with a single auditable platform.

---

# 2. Product Principles

The architecture should follow six principles.

### 2.1 Property is the core aggregate

Everything ultimately relates to:

```text
Organization
   ↓
Portfolio
   ↓
Property
   ↓
Building
   ↓
Floor
   ↓
Unit
```

But the hierarchy must remain flexible.

A landlord owning three individual apartments shouldn't need to create meaningless buildings/floors.

### 2.2 Lease ≠ Tenant

Never model:

```text
Unit
 └── tenantId
```

Instead:

```text
Unit
   ↓
Lease
   ↓
LeaseParty
   ↓
Person
```

A person can have multiple historical leases.

A unit can have many historical leases but normally only one active exclusive lease at a time.

### 2.3 Financial records must be immutable

Don't treat rent as:

```ts
tenant.balance = 50000;
```

Use a ledger model.

```text
Charge
Payment
Allocation
Adjustment
Credit
Refund
Deposit Transaction
```

Financial history should never be destroyed by editing a balance.

### 2.4 Human workflows are first-class

Bangladesh property management is not completely automated.

The system must support:

```text
Digital
Manual
Cash
Bank
MFS
Phone
WhatsApp
Paper documents
Manual verification
```

Your source explicitly identifies offline payment tracking as important alongside MFS and bank payments. 

### 2.5 Every sensitive action is auditable

Who changed rent?

Who marked cash as received?

Who approved a tenant?

Who downloaded someone's NID?

Who refunded a deposit?

Who changed a lease?

Those answers must always exist.

### 2.6 Start as a modular monolith

Do **not** start this as 15 microservices.

NestJS is ideal for:

```text
modules/
  auth/
  organizations/
  users/
  properties/
  units/
  crm/
  applications/
  screening/
  leases/
  billing/
  payments/
  accounting/
  maintenance/
  inspections/
  documents/
  notifications/
  reports/
  audit/
```

Keep domain boundaries clean enough that modules can later be extracted.

---

# 3. Primary Actors

The source identifies overlapping owner, renter, agent, crew and management relationships, including delegated authority and multi-owner situations. 

I would formalize them as follows.

| Actor                | Purpose                        |
| -------------------- | ------------------------------ |
| Platform Super Admin | Operates Ferio Rental SaaS     |
| Organization Owner   | Owns customer workspace        |
| Property Owner       | Beneficial/legal owner         |
| Property Manager     | Manages portfolio              |
| Building Manager     | Manages assigned buildings     |
| Accountant           | Billing, collection, expenses  |
| Collection Officer   | Collects/records rent          |
| Leasing Officer      | Leads, viewings, applications  |
| Agent/Broker         | Introduces prospective tenants |
| Tenant               | Occupies rented property       |
| Co-Tenant            | Additional lease party         |
| Guarantor            | Guarantees tenant              |
| Owner Representative | Acts on owner's behalf         |
| Maintenance Manager  | Handles maintenance            |
| Technician/Vendor    | Performs work                  |
| Security/Caretaker   | Limited operational access     |
| Auditor/Viewer       | Read-only oversight            |

This should **not** be implemented using one giant `UserRole` enum.

---

# 4. Authorization Model

Use:

> **RBAC + scoped permissions + delegation**

For example:

```text
Role: PROPERTY_MANAGER

Permissions:
property.read
property.update
unit.read
unit.update
lease.read
lease.create
lease.update
billing.read
maintenance.manage
tenant.read
document.read
```

But permissions need scopes:

```text
Organization
Portfolio
Property
Building
Unit
Lease
```

Therefore:

```text
Rahim
PROPERTY_MANAGER
Property A + Property B

Karim
ACCOUNTANT
Entire organization

Sakib
CARETAKER
Building C only
```

Delegation should also be time-bound, which is specifically called out in the source. 

---

# 5. Multi-Tenancy

Architect Ferio Rental as SaaS from day one.

```text
Ferio Rental
│
├── Organization A
│   ├── Users
│   ├── Properties
│   ├── Tenants
│   └── Financial records
│
├── Organization B
│   ├── Users
│   └── Properties
│
└── Organization C
```

Almost every business table should contain:

```ts
organizationId
```

Isolation must occur server-side.

Never trust an incoming:

```http
organizationId
```

without checking membership and authorization.

---

# 6. Property Domain

This becomes one of the central bounded contexts.

## Property

Examples:

```text
Residential Building
Individual Apartment
Commercial Building
Office
Shop
House
Warehouse
Mixed-use
```

Core fields:

```ts
Property {
  id
  organizationId

  name
  code

  propertyType

  address
  district
  area

  latitude
  longitude

  ownershipType

  status

  createdAt
  updatedAt
}
```

## Building

```ts
Building {
  id
  propertyId

  name
  buildingNumber

  floors
  constructionYear

  liftCount
  parkingCount

  status
}
```

## Unit

```ts
Unit {
  id
  propertyId
  buildingId?

  unitNumber
  floor?

  unitType

  bedrooms?
  bathrooms?
  balconies?

  areaSqFt?

  marketRent?
  targetRent?

  status
}
```

Unit state:

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

---

# 7. Ownership

Do not put:

```text
property.ownerId
```

on the property.

Your source already recognizes that co-ownership and delegated management occur. 

Model:

```text
Property
   ↓
PropertyOwnership
   ↓
Owner
```

Example:

```text
Apartment 8B

Mohammad Rahman       50%
Fatema Rahman         30%
Sadia Rahman          20%
```

`PropertyOwnership`:

```ts
{
  propertyId
  ownerId

  ownershipPercentage

  effectiveFrom
  effectiveTo

  isPrimaryContact
}
```

This makes historical ownership possible.

---

# 8. CRM / Leasing Pipeline

This is an important improvement over the attached proposal.

Before someone becomes a tenant, they're a **lead/prospect**.

Pipeline:

```text
NEW LEAD
   ↓
CONTACTED
   ↓
QUALIFIED
   ↓
VIEWING SCHEDULED
   ↓
VIEWING COMPLETED
   ↓
INTERESTED
   ↓
APPLICATION
   ↓
VERIFICATION
   ↓
NEGOTIATION
   ↓
APPROVED
   ↓
LEASE PREPARATION
   ↓
SIGNED
   ↓
MOVE-IN
```

A rejected lead remains historical CRM data.

---

# 9. Lead Management

Lead sources:

```text
Walk-in
Facebook
Website
WhatsApp
Agent
Referral
Bikroy
Phone
Existing tenant
Other
```

Capture:

```ts
RentalLead {
  name
  phone
  email?

  source
  sourceAgentId?

  interestedUnitId?

  expectedMoveIn
  budgetMin
  budgetMax

  familySize?
  occupation?

  status

  assignedTo
}
```

Activities:

```text
Phone Call
WhatsApp
SMS
Email
Viewing
Meeting
Note
Follow-up
```

This creates an actual CRM rather than merely property-management software.

---

# 10. Viewing Management

A prospect can view multiple units.

```text
Lead
 ├── Viewing → Unit 4A
 ├── Viewing → Unit 7B
 └── Viewing → Unit 9C
```

Record:

```text
scheduledAt
completedAt
agent
employee
prospectFeedback
interestLevel
followUpAt
```

---

# 11. Rental Application

Once interested:

```text
Lead → RentalApplication
```

Capture:

```text
Personal information
NID/passport
Occupation
Employer
Income
Current address
Previous landlord
Family members
Expected occupants
Vehicle information
Emergency contact
References
Guarantors
Documents
```

Application state machine:

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

---

# 12. Guarantor Management

This is one of the strongest Bangladesh-specific requirements in the supplied research.

The document proposes multiple guarantors, types such as family/employer/previous landlord/community references, contact verification and optional income proof. 

Don't tie a guarantor permanently to one renter.

Use:

```text
Person
 ↓
ApplicationGuarantor
 ↓
Application
```

Then after lease creation:

```text
LeaseGuarantor
```

That preserves historical truth.

---

# 13. Verification Engine

Instead of inventing a magical “tenant score,” implement a verification checklist.

Examples:

```text
✓ NID collected
✓ NID manually verified
✓ Phone verified
✓ Employer contacted
✓ Previous landlord contacted
✓ Guarantor contacted
✓ Income document reviewed
✓ Permanent address verified
✓ Emergency contact verified
```

Each verification:

```ts
Verification {
  subjectType
  subjectId

  type
  status

  verifiedBy
  verifiedAt

  notes
  evidenceDocumentId?
}
```

Status:

```text
PENDING
VERIFIED
FAILED
WAIVED
EXPIRED
```

---

# 14. Lease Management

Lease becomes the contractual core.

```ts
Lease {
  id
  organizationId
  unitId

  leaseNumber

  startDate
  endDate

  status

  rentAmount
  securityDeposit

  billingFrequency

  dueDay

  gracePeriodDays

  noticePeriodDays

  renewalType

  signedAt?
  activatedAt?
  terminatedAt?
}
```

Statuses:

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

---

# 15. Lease Parties

Never assume one renter.

```text
Lease
 ├── Primary Tenant
 ├── Spouse
 ├── Co-Tenant
 ├── Guarantor
 └── Authorized Occupant
```

Model:

```ts
LeaseParty {
  leaseId
  personId

  role

  isFinanciallyResponsible
  isOccupant
}
```

---

# 16. Rent Negotiation

Bangladesh rent terms are negotiated.

Therefore preserve negotiation history.

```text
Owner asks:       ৳45,000
Tenant offers:    ৳40,000
Owner counters:   ৳43,000
Tenant counters:  ৳42,000
Accepted:         ৳42,000
```

Never overwrite the previous proposal.

Store:

```text
LeaseOffer
LeaseOfferVersion
```

This becomes useful evidence later.

---

# 17. Move-In

Signing the lease should trigger a move-in workflow.

```text
Lease Signed
    ↓
Deposit collected
    ↓
Advance collected
    ↓
Move-in inspection
    ↓
Meter readings
    ↓
Keys issued
    ↓
Occupants confirmed
    ↓
Documents completed
    ↓
Unit → OCCUPIED
    ↓
Lease → ACTIVE
```

Don't allow arbitrary state changes.

Use application services/domain rules.

---

# 18. Inspection System

The source specifically recommends move-in and move-out photographic evidence. 

Inspection:

```text
Living Room
  ✓ Walls
  ✓ Floor
  ✓ Windows

Kitchen
  ✓ Sink
  ✓ Gas line
  ✓ Cabinets

Bathroom
  ✓ Basin
  ✓ Shower
  ✓ Toilet
```

Each item:

```text
GOOD
FAIR
DAMAGED
MISSING
NOT_APPLICABLE
```

with:

```text
photos[]
notes
estimatedRepairCost
```

Later:

```text
Move-In Inspection
        ↕
Move-Out Inspection
```

can be compared.

---

# 19. Billing Architecture

This deserves financial-grade design.

The source already proposes itemized billing containing rent, service charges, utilities and previous debt. 

Model:

```text
BillingAccount
    ↓
Invoice
    ↓
InvoiceLine
```

Example:

```text
June 2026

Rent                  ৳40,000
Service Charge         ৳3,000
Electricity            ৳2,410
Water                    ৳600
Parking                 ৳1,500
Previous adjustment      -৳500
--------------------------------
TOTAL                  ৳47,010
```

Invoice state:

```text
DRAFT
ISSUED
PARTIALLY_PAID
PAID
OVERDUE
VOID
WRITTEN_OFF
```

---

# 20. Charges

Support:

```text
RENT
SERVICE_CHARGE
ELECTRICITY
WATER
GAS
INTERNET
PARKING
MAINTENANCE
LATE_FEE
OTHER
DISCOUNT
ADJUSTMENT
```

Do not hardcode totals into the lease.

---

# 21. Recurring Charge Engine

Lease defines recurring rules.

Example:

```text
Rent
৳40,000
Monthly
Due: 5th

Service charge
৳3,000
Monthly

Parking
৳1,500
Monthly
```

A scheduled worker generates invoices.

Use a queue:

```text
BullMQ + Redis
```

Example jobs:

```text
GenerateMonthlyInvoicesJob
MarkOverdueInvoicesJob
SendRentReminderJob
LeaseExpiryReminderJob
PaymentReconciliationJob
```

Jobs must be **idempotent**.

---

# 22. Payment Architecture

Payment is separate from invoice.

```text
Invoice ৳50,000
        ↓
Payment A ৳20,000
Payment B ৳30,000
```

Therefore:

```text
Payment
PaymentAllocation
Invoice
```

One payment can even cover multiple invoices.

---

# 23. Supported Payment Channels

Architect provider abstraction:

```ts
interface PaymentProvider {
  initiatePayment()
  verifyPayment()
  processWebhook()
  refund()
}
```

Providers may eventually include:

```text
bKash
Nagad
Bank
Payment gateway
Cash
Cheque
Manual MFS
```

The attached research specifically treats digital and manual/offline payment support as necessary rather than forcing all rent through one channel. 

---

# 24. Cash Collection

Cash is dangerous operationally.

Workflow:

```text
Collector receives ৳40,000
       ↓
records payment
       ↓
system generates receipt
       ↓
collector identity recorded
       ↓
manager/accountant verifies
       ↓
payment posted
```

For larger organizations:

```text
RECORDED
PENDING_VERIFICATION
VERIFIED
REJECTED
```

Never allow the person collecting money to silently modify the record afterward.

---

# 25. Financial Ledger

I'd go further than the attached proposal here.

Create an append-oriented financial ledger.

```ts
LedgerEntry {
  id

  organizationId
  accountId

  transactionType

  debit
  credit

  referenceType
  referenceId

  occurredAt
  createdAt
}
```

This gives you reliable:

```text
Outstanding rent
Collections
Deposits held
Refunds
Owner payable
Maintenance expenses
Agent payable
```

and makes reconciliation possible.

---

# 26. Security Deposit Ledger

Never represent deposit only as:

```ts
lease.securityDeposit = 100000
```

Track movements.

```text
Deposit Required        ৳100,000
Deposit Received        ৳100,000
Repair Deduction         -৳8,000
Utility Deduction        -৳2,000
Refunded                 -৳90,000
Balance                        0
```

This will prevent major disputes.

---

# 27. Utilities

Utility configuration per unit:

```text
OWNER_INCLUDED
TENANT_DIRECT
FIXED_CHARGE
INDIVIDUAL_METER
SHARED_METER
```

For shared utilities:

```text
Equal
Occupancy
Area
Percentage
Meter/submeter
Manual
```

The source explicitly calls for utility-sharing/apportionment and identifies it as a Bangladesh-native differentiator. 

---

# 28. Meter Management

Model:

```text
Meter
MeterReading
UtilityBill
UtilityAllocation
```

Meter types:

```text
ELECTRICITY
WATER
GAS
GENERATOR
OTHER
```

Reading:

```text
previousReading
currentReading
consumption
readingDate
photo
recordedBy
```

Photos matter because meter disputes happen.

---

# 29. Maintenance

Workflow:

```text
OPEN
 ↓
TRIAGED
 ↓
ASSIGNED
 ↓
SCHEDULED
 ↓
IN_PROGRESS
 ↓
WAITING_PARTS
 ↓
RESOLVED
 ↓
TENANT_CONFIRMED
 ↓
CLOSED
```

Allow:

```text
REOPENED
CANCELLED
```

The attached research proposes a similar reported→accepted→in-progress→resolved lifecycle with renter confirmation. 

---

# 30. Maintenance Priority

```text
EMERGENCY
URGENT
NORMAL
LOW
```

Examples:

**Emergency**

```text
Fire
Gas leak
Major electrical danger
Security breach
Major flooding
```

These can have escalation rules.

---

# 31. Work Orders

Ticket and work order should be separate.

```text
MaintenanceRequest
       ↓
WorkOrder
       ↓
Vendor/Technician
```

Why?

A single complaint may require:

```text
Electrician
+
Plumber
+
Painter
```

Each work order has its own cost and status.

---

# 32. Vendor Management

Vendor:

```text
Electrician
Plumber
Painter
Cleaning company
Lift company
Generator technician
Security company
Internet provider
```

Track:

```text
jobs completed
response time
cost
rating
payment history
documents
```

---

# 33. Expense Management

Property managers need expenses independent of maintenance tickets.

Examples:

```text
Repair
Cleaning
Security
Generator fuel
Lift maintenance
Property tax
Management expense
Staff salary
Utility common area
```

Every expense:

```text
Property
Category
Amount
Vendor
Date
Receipt
Payment method
Approved by
```

---

# 34. Agent/Broker CRM

Agents should be first-class entities.

Your source calls for agent listing, renter attribution, commission calculation and payment tracking. 

Architecture:

```text
Agent
 ↓
Lead Attribution
 ↓
Viewing
 ↓
Application
 ↓
Lease
 ↓
Commission
```

Commission lifecycle:

```text
PENDING
EARNED
APPROVED
PAID
CANCELLED
DISPUTED
```

Do not simply store:

```text
commissionPaid = true
```

---

# 35. Communication Hub

Every tenant/property should have communication history.

```text
Phone
SMS
Email
WhatsApp
System notification
Internal note
```

Represent:

```ts
Communication {
  channel
  direction

  subjectType
  subjectId

  sender
  recipient

  message

  occurredAt
}
```

That means six months later an employee can see:

> Tenant reported water leak on 14 March, manager replied 15 March, plumber attended 16 March.

---

# 36. Notification Engine

Event-driven internally.

Example:

```text
InvoiceIssued
     ↓
Notification Service
     ├── Push
     ├── Email
     ├── SMS
     └── WhatsApp
```

Don't embed notification sending throughout controllers.

Use domain events / outbox.

Your existing Ferio e-commerce experience with transactional messaging/outbox patterns is highly reusable here.

---

# 37. Document Management

Documents need classification.

```text
PROPERTY
OWNER
TENANT
APPLICATION
LEASE
MAINTENANCE
PAYMENT
INSPECTION
VENDOR
```

Types:

```text
NID
Passport
Property deed
RAJUK documents
Rental agreement
Income proof
Receipt
Utility bill
Inspection photo
Notice
Authorization letter
```

The source also anticipates searchable rental agreements, ownership proof and building/property documents. 

---

# 38. Document Security

Never expose raw storage paths.

Use:

```text
private object storage
+
signed URLs
+
authorization
+
expiration
```

Sensitive documents should record:

```text
uploadedBy
downloadedBy
downloadedAt
IP
```

especially NID/passport documents.

---

# 39. Renewal Management

Automatically identify leases:

```text
120 days remaining
90
60
30
15
7
expired
```

Workflow:

```text
Lease Expiring
    ↓
Renew?
   ↙   ↘
YES    NO
 ↓      ↓
Offer   Notice
 ↓      ↓
Negotiation
 ↓
Renewal Lease
```

Never overwrite the old lease.

Create a new lease/version linked through:

```text
renewedFromLeaseId
```

---

# 40. Rent Increase

Rent increases should be proposals, not direct field updates.

```text
Current: ৳40,000

Owner proposes:
৳44,000 effective Jan 1

Tenant:
COUNTER → ৳42,000

Owner:
ACCEPT

Renewal:
৳42,000
```

Maintain full history.

The source similarly emphasizes keeping old rent, new rent, effective date and notice information. 

---

# 41. Move-Out

Move-out is a workflow.

```text
Notice received
      ↓
Move-out scheduled
      ↓
Outstanding invoices calculated
      ↓
Move-out inspection
      ↓
Damage assessment
      ↓
Deposit settlement
      ↓
Keys returned
      ↓
Lease closed
      ↓
Unit → AVAILABLE / MAINTENANCE_HOLD
```

---

# 42. Tenant Portal / PWA

Tenant should see only what matters.

```text
Home
My Unit
Rent
Bills
Payments
Receipts
Maintenance
Lease
Documents
Notices
Profile
```

Dashboard:

```text
Next Rent
৳42,000
Due Sep 5

Outstanding
৳0

Lease
287 days remaining

Maintenance
1 open request
```

---

# 43. Owner Portal

Owner experience differs from operator/admin.

```text
Portfolio
Occupancy
Collections
Outstanding
Expenses
Net income
Maintenance
Lease expiry
Documents
Statements
```

For an NRB owner:

```text
Property 1

August Rent       ৳50,000
Expenses          -৳7,000
Management Fee    -৳2,500
--------------------------
Owner Payable     ৳40,500
```

Delegated management is particularly important for remote/NRB ownership according to the source. 

---

# 44. Admin / Property Manager Dashboard

Top-level KPIs:

```text
Total Units
Occupied Units
Vacant Units
Occupancy %

Rent Due
Rent Collected
Outstanding
Collection %

Security Deposits Held

Open Maintenance
Emergency Tickets

Expiring Leases
Applications Pending

Monthly Revenue
Monthly Expenses
NOI
```

---

# 45. Reporting

Minimum report set:

```text
Rent Roll
Collection Report
Outstanding Rent/Aging
Tenant Ledger
Lease Expiry
Occupancy
Vacancy
Security Deposit
Utility Recovery
Maintenance Cost
Property Expense
Agent Commission
Owner Statement
Cash Collection
Payment Reconciliation
```

Aging report:

```text
0–30 days
31–60
61–90
90+
```

---

# 46. Audit Architecture

Reuse what you learned from Ferio.

Every sensitive mutation should generate:

```ts
AuditEvent {
  id
  organizationId

  actorId
  actorType

  action

  resourceType
  resourceId

  before?
  after?

  ip
  userAgent
  correlationId

  timestamp
}
```

Critical actions:

```text
Rent changed
Lease edited
Cash recorded
Payment reversed
Deposit deducted
Document accessed
Role changed
Permission changed
Owner changed
Tenant approved
Invoice voided
Expense approved
```

Audit logs should be append-only.

---

# 47. Authentication

Support:

```text
Email/password
Phone OTP
Google OAuth
```

Staff/admin:

```text
Password
+
TOTP MFA
```

Session architecture can follow your hardened Ferio model.

---

# 48. API Architecture

Use versioning from day one:

```text
/api/v1/
```

Example resources:

```http
GET  /properties
POST /properties

GET  /properties/:id/units

GET  /units/:id

POST /leads
POST /leads/:id/viewings

POST /applications
POST /applications/:id/approve

POST /leases
POST /leases/:id/activate

GET  /leases/:id/ledger

POST /invoices
POST /payments

POST /maintenance-requests
POST /work-orders

POST /inspections

GET /reports/rent-roll
```

Controllers remain thin:

```text
Controller
   ↓
Application Service
   ↓
Domain Logic
   ↓
Repository/Prisma
```

---

# 49. Backend Bounded Contexts

I'd structure `ferio-nest-prisma` approximately as:

```text
src/
├── auth/
├── iam/
├── organizations/
├── people/
├── owners/
├── properties/
├── units/
│
├── crm/
│   ├── leads/
│   ├── activities/
│   └── viewings/
│
├── applications/
├── screening/
├── guarantors/
│
├── leasing/
│   ├── leases/
│   ├── lease-parties/
│   ├── negotiations/
│   ├── renewals/
│   └── terminations/
│
├── billing/
│   ├── charges/
│   ├── invoices/
│   └── recurring-rules/
│
├── payments/
├── ledger/
├── deposits/
├── expenses/
│
├── utilities/
├── meters/
│
├── maintenance/
├── work-orders/
├── vendors/
│
├── inspections/
├── documents/
├── communications/
├── notifications/
│
├── agents/
├── commissions/
│
├── reports/
├── audit/
├── jobs/
├── integrations/
└── common/
```

That is considerably safer than:

```text
property.service.ts
tenant.service.ts
payment.service.ts
```

growing into 5,000-line god services.

---

# 50. Core Data Model

At architecture level, your graph becomes:

```text
Organization
│
├── OrganizationMember
│
├── Portfolio
│
└── Property
      │
      ├── PropertyOwnership
      │      └── Owner
      │
      ├── Building
      │      └── Unit
      │
      ├── Expense
      └── VendorAssignment

Unit
│
├── Viewing
├── Application
├── Inspection
├── Meter
├── MaintenanceRequest
└── Lease
      │
      ├── LeaseParty
      ├── LeaseGuarantor
      ├── RecurringCharge
      ├── Invoice
      │     └── InvoiceLine
      │
      ├── PaymentAllocation
      │     └── Payment
      │
      ├── DepositTransaction
      ├── Renewal
      └── Termination

Person
│
├── TenantProfile
├── OwnerProfile
├── AgentProfile
├── GuarantorRelationship
└── VendorContact
```

This is the conceptual backbone I'd freeze **before writing the Prisma schema**.

---

# 51. State Machines

This is another area where I would make Ferio Rental more mature than a typical CRUD application.

### Unit

```text
AVAILABLE
   ↓
RESERVED
   ↓
OCCUPIED
   ↓
NOTICE_GIVEN
   ↓
MOVE_OUT_PENDING
   ↓
AVAILABLE
```

### Application

```text
DRAFT → SUBMITTED → REVIEWING
                     ↓
             APPROVED / REJECTED
```

### Lease

```text
DRAFT
 ↓
PENDING_SIGNATURE
 ↓
SIGNED
 ↓
ACTIVE
 ↓
EXPIRING
 ↓
EXPIRED
```

with controlled branches to:

```text
TERMINATED
CANCELLED
```

### Invoice

```text
DRAFT → ISSUED → PARTIALLY_PAID → PAID
                   ↓
                OVERDUE
```

Don't permit arbitrary status updates through generic PATCH endpoints.

---

# 52. Concurrency Requirements

Property systems have important race conditions.

Example:

Two leasing officers attempt to reserve Unit 4B.

Both read:

```text
AVAILABLE
```

Both approve applicants.

Now you have two tenants.

Prevent with database transaction/locking/unique constraints.

Likewise:

```text
Only one active exclusive lease per unit
Only one active reservation where applicable
Webhook cannot post payment twice
Invoice generation cannot duplicate a period
```

---

# 53. Idempotency

Mandatory for:

```text
Payment initiation
Payment webhooks
Invoice generation
Receipt generation
Lease activation
Refunds
Scheduled jobs
Notification dispatch
```

Use:

```text
idempotencyKey
externalReference
unique constraints
```

---

# 54. Integration Architecture

Never let domain services directly depend on bKash/WhatsApp/etc.

Use ports/adapters:

```text
PaymentProvider
   ├── BkashAdapter
   ├── NagadAdapter
   └── ManualPaymentAdapter

MessagingProvider
   ├── WhatsAppAdapter
   ├── SMSAdapter
   ├── EmailAdapter
   └── PushAdapter

StorageProvider
   ├── S3Adapter
   └── CloudflareR2Adapter
```

Changing providers then doesn't rewrite business logic.

---

# 55. Infrastructure

For the initial production architecture:

```text
                  ┌─────────────────┐
                  │ Cloudflare/CDN  │
                  └────────┬────────┘
                           │
              ┌────────────▼────────────┐
              │       NestJS API        │
              │ Modular Monolith        │
              └──────┬───────────┬──────┘
                     │           │
              ┌──────▼───┐ ┌────▼─────┐
              │PostgreSQL│ │   Redis   │
              └──────────┘ └────┬─────┘
                                │
                          ┌─────▼─────┐
                          │  Workers  │
                          │  BullMQ   │
                          └───────────┘

              ┌──────────────────────┐
              │ Private Object Store │
              │ Documents / Images   │
              └──────────────────────┘
```

This is enough.

No Kafka.

No Kubernetes.

No premature microservices.

---

# 56. Observability

Reuse the maturity you added to Ferio.

Every request:

```text
requestId
correlationId
actorId
organizationId
method
route
status
duration
clientIp
userAgent
```

Operational metrics:

```text
API latency
5xx rate
DB query latency
Redis availability
Queue depth
Failed jobs
Webhook failures
Payment reconciliation failures
Notification failures
```

---

# 57. Search

PostgreSQL can handle the MVP.

Global admin search:

```text
Tenant name
Phone
NID reference
Property
Building
Unit
Lease number
Invoice
Payment reference
Maintenance ticket
Agent
```

Later, once volume actually requires it:

```text
Typesense / Elasticsearch
```

Don't add it on day one.

---

# 58. Non-Functional Requirements

Targets for Release 1:

```text
API p95               < 500 ms for standard reads
Availability           ≥ 99.5%
Financial precision    exact decimal/integer monetary representation
Audit coverage         100% sensitive operations
Webhook idempotency    mandatory
Tenant isolation       mandatory
Backup                 daily + PITR where available
RPO                     ≤ 24h initially
RTO                     ≤ 4h initially
```

Never store BDT money as JavaScript floating-point calculations.

Use integer poisha or PostgreSQL decimal with disciplined conversion.

---

# 59. Privacy

The source contains several legal assertions that should **not be blindly encoded as business rules** until checked by Bangladeshi counsel; for example, it lists particular rental-law, stamp-paper and data-protection interpretations. 

Therefore architecture should expose:

```text
ComplianceRule
DocumentRequirement
NoticeTemplate
RetentionPolicy
```

as configurable policy rather than scattering:

```ts
if (noticeDays < 30) throw ...
```

through services.

This is an important architectural correction to the supplied proposal.

---

# 60. MVP — Release 1

I would **not** implement everything in the supplied document immediately.

Your first release should prove one question:

> Can a property manager run their everyday rental operation through Ferio Rental?

Release 1:

```text
Authentication + organizations
Staff/RBAC

Owners
Properties
Buildings
Units

Tenant/people directory

Lead CRM
Viewings
Applications
Guarantors
Verification checklist

Lease management
Lease parties
Deposits
Move-in

Recurring rent/service charges
Invoice generation
Manual payments
Cash/bank/MFS recording
Receipts
Tenant ledger

Maintenance tickets
Vendor/technician assignment

Documents
Notifications
Audit logs

Basic dashboard
Rent roll
Collection report
Outstanding report
Lease expiry report
```

---

# 61. Release 2

Then add operational depth:

```text
Online bKash/payment integration
Utility apportionment
Meters/readings
Inspections
Move-out
Deposit deductions/refunds
Agent commissions
Renewals
Rent negotiation
Expenses
Owner statements
WhatsApp integration
Advanced reports
```

---

# 62. Release 3

Scale features:

```text
NRB owner portal
Owner payouts
Property-manager SaaS subscriptions
Advanced accounting
Bulk operations
Automation rules
Vendor portal
Tenant PWA
Mobile app
Advanced analytics
API/webhooks for enterprise clients
```

The supplied roadmap similarly moves from apartment/renter/billing/maintenance foundations into agent, utility, inspection and later NRB/property-manager functionality. 

---

# 63. What NOT to Build Initially

I would explicitly reject these for V1:

```text
❌ Property marketplace
❌ Airbnb-style discovery
❌ AI tenant scoring
❌ Automated NID verification unless legitimate APIs exist
❌ Cryptocurrency
❌ Complex accounting ERP
❌ Utility-company integrations
❌ Native iOS/Android applications
❌ Microservices
❌ Elasticsearch
❌ Kafka
❌ Recommendation engine
❌ Smart-home integrations
```

Your competitive advantage initially comes from **workflow completeness**, not technology count.

---

# 64. Critical Product Metrics

Don't measure only registered users.

### Portfolio

```text
Organizations onboarded
Properties managed
Units managed
Occupied units
```

### Leasing

```text
Lead → viewing conversion
Viewing → application
Application → approval
Approval → lease
Average vacancy duration
Time-to-lease
```

### Financial

```text
Rent billed
Rent collected
Collection rate
Outstanding balance
30/60/90 aging
Digital payment %
Deposit liability
```

### Operations

```text
Open maintenance requests
Average response time
Average resolution time
Reopened %
Maintenance cost/unit
```

### SaaS

```text
MRR
ARPU
Trial → paid
Logo churn
Revenue churn
Net revenue retention
```

The source already proposes apartment count, MAU, payment volume, agent adoption, NPS and churn as early success indicators. 

---

# 65. Architectural North Star

The most important distinction is this:

### Don't build

```text
Property CRUD
Tenant CRUD
Rent CRUD
Maintenance CRUD
```

### Build

```text
                    FERIO RENTAL

                 ORGANIZATION / IAM
                         │
             ┌───────────┴───────────┐
             │                       │
        PROPERTY GRAPH          PEOPLE GRAPH
             │                       │
      Property → Unit        Owner / Tenant /
             │              Agent / Guarantor
             └──────────┬────────────┘
                        │
                 LEASING ENGINE
                        │
          Application → Lease → Renewal
                        │
             ┌──────────┴──────────┐
             │                     │
       FINANCIAL ENGINE      OPERATIONS ENGINE
             │                     │
      Billing/Ledger          Maintenance
      Payments                Inspections
      Deposits                Vendors
      Expenses                Utilities
             │                     │
             └──────────┬──────────┘
                        │
               COMMUNICATION LAYER
                        │
             Email / SMS / WhatsApp
                        │
                 AUDIT + REPORTING
```

That architecture can support **a landlord with 2 apartments, a family managing 30 units, an NRB portfolio, or a professional property manager operating thousands of units** without redesigning the fundamental model.

And importantly, I would keep **`ferio-rental` completely separate from your e-commerce database/schema**. Reuse engineering patterns and selected infrastructure code—not commerce-domain models. The attached research is valuable as domain input, but the model above turns it into a much more defensible SaaS architecture rather than a collection of Bangladesh-specific CRUD features. 
