Yes — I understand the product much better now, and your criticism is correct. **The current implementation is solving the wrong product.**

I reviewed the deployed site. Right now it behaves mainly like an internal property-management ERP for one organization called “Dhaka Prime Properties”: the home page immediately opens an operator dashboard with occupancy, revenue, leases, billing, maintenance and administrative navigation. ([Ferio Rental][1]) Even the public marketplace is rendered inside essentially the same administrative shell. ([Ferio Rental][2]) The owner portal also assumes Ferio collects money, deducts management fees/repairs and then disburses a net amount through an “escrow” style model. ([Ferio Rental][3])

That is **not the product you're describing now**.

# Ferio Rental should actually be two products sharing one platform

The architecture should be:

```text
                         FERIO PROPERTY PLATFORM
                                  │
              ┌───────────────────┴───────────────────┐
              │                                       │
              ▼                                       ▼
     PUBLIC PROPERTY MARKETPLACE               FERIO RENTAL SaaS
         Free / Public Side                    Subscription Side
              │                                       │
    Rent / Sale / Commercial                Property Operations CRM
```

This distinction changes almost everything.

---

# 1. Public Marketplace

Anyone should be able to visit:

```text
ferio.com
```

without being a SaaS customer.

They can search:

```text
Apartments
Flats
Houses
Rooms
Sublets

Shops
Commercial spaces
Offices

Store rooms
Warehouses

Land

Property for sale
Commercial property for sale
```

This should look like a **real property marketplace**, not an admin dashboard.

The public navigation should be something like:

```text
FERIO

Buy
Rent
Commercial
Land
Post Property
Map Search

                         Login
                         Manage Properties
```

A renter/buyer opens Ferio and sees property discovery first.

---

# 2. Search should be location-first

This part of your idea is strong.

Every listing should have:

```text
latitude
longitude
division
district
area
neighbourhood
address
```

Then OpenStreetMap can power:

```text
Search around me

Search in Rampura

Search within map bounds

Search within 2 km / 5 km

Draw/search an area

Map markers

List + map view
```

For example:

```text
                 [ Search Rampura, Dhaka ]

Filters:
Rent ৳15k–৳40k
2–3 Beds
Apartment
Family
Parking

────────────────────────────────────────────

             OpenStreetMap

          ● ৳25k      ● ৳32k
     ● ৳18k       ● ৳28k

────────────────────────────────────────────

27 properties found
```

And PostgreSQL should eventually use **PostGIS**, rather than treating latitude/longitude as decorative fields.

That gives you queries such as:

```text
units within 3 km
properties inside current map viewport
nearest properties
properties around specific coordinates
```

---

# 3. Free property advertising does NOT require SaaS subscription

This was missing from the earlier architecture.

A person who owns one flat should be able to:

```text
Create account
     ↓
Post Property
     ↓
Upload photos
     ↓
Add location
     ↓
Set rent
     ↓
Add contact information
     ↓
Publish
```

without buying Ferio Rental.

So:

```text
No Subscription
       │
       ├── Post rental advertisement ✅
       ├── Post property-for-sale advertisement ✅
       ├── Receive leads ✅
       ├── Update listing ✅
       └── Basic profile ✅

       BUT

       ├── Tenant management ❌
       ├── Automated billing ❌
       ├── Utility management ❌
       ├── Maintenance CRM ❌
       ├── Ledger/accounting ❌
       ├── Staff management ❌
       ├── Advanced reports ❌
       └── Building operations ❌
```

That is the correct freemium acquisition model.

---

# 4. Subscription upgrades them into the Rental SaaS

Suppose I own one building with 20 flats.

I can buy:

```text
Ferio Rental Pro
```

and Ferio creates what we previously called a SaaS tenant.

But I recommend **never calling this a `Tenant` in the codebase**.

You already have renters/tenants in the rental domain, so this becomes extremely confusing:

```text
SaaS Tenant
Tenant
Tenant of tenant
```

Use:

```text
Organization
```

or:

```text
Workspace
```

instead.

My preference:

```text
Organization
```

So:

```text
Ferio Platform

Organization A
"Sheakh Properties"

Organization B
"ABC Property Management"

Organization C
"Rahman Family Properties"
```

---

# 5. Platform Admin creates/manages Organizations

Your System Admin belongs above all customers:

```text
                    FERIO PLATFORM ADMIN
                             │
          ┌──────────────────┼───────────────────┐
          ▼                  ▼                   ▼
   Organization A     Organization B      Organization C
   Sheakh Properties  ABC Management      XYZ Holdings
```

System Admin manages:

```text
Organizations
Plans
Subscriptions
Payments
Platform users
Marketplace moderation
Property ads
Reports
Feature flags
Support
Abuse
Verification
```

The property owner does **not** become the platform admin.

---

# 6. One Organization can have multiple owners

This is the model you described:

```text
Organization
"Sheakh Family Properties"

      │
      ├── Mohammad — Owner
      ├── Rahim — Owner
      └── Karim — Manager
```

They may jointly manage:

```text
Building A
Building B
3 separate apartments
2 shops
1 warehouse
```

Each organization member gets permissions.

---

# 7. But ownership belongs at UNIT level too

This is extremely important.

Your statement:

> one building can have multiple unit owners

means this architecture:

```text
                      Building
                 "Rose Valley Heights"
                         │
        ┌────────────────┼────────────────┐
        │                │                │
      Unit 1A          Unit 1B          Unit 1C
        │                │                │
        ▼                ▼                ▼
   Owner Rahim       Owner Karim     Owner Mohammad
```

Therefore:

```text
Building.ownerId
```

is insufficient.

You need:

```text
PropertyOwnership
UnitOwnership
```

and potentially:

```text
OwnershipShare
```

Example:

```text
Unit 4B

Rahim           50%
Sultana         50%
```

---

# 8. Renter pays the UNIT OWNER directly

This is another major correction.

The current site assumes Ferio/property manager receives gross rent and disburses a net payment to the owner. ([Ferio Rental][3])

That should **not be the default architecture**.

Instead:

```text
Renter
  │
  │ Rent ৳35,000
  ▼
Unit Owner's Payment Destination
```

Ferio records and verifies the payment.

Possible destination:

```text
Owner bKash
Owner Nagad
Owner bank account
Cash
Cheque
Other MFS
```

So each rentable unit/lease can have:

```ts
RentCollectionDestination {
    beneficiaryOwnerId
    method

    bkashNumber?
    nagadNumber?

    bankAccountId?

    instructions?
}
```

Ferio's SaaS subscription payment is completely separate:

```text
Property Owner
      │
      │ Subscription Fee
      ▼
FERIO
```

while:

```text
Renter
      │
      │ Rent
      ▼
Unit Owner
```

These are **two entirely different payment flows**.

---

# 9. Rental lifecycle

Now the SaaS side becomes:

```text
Organization
    ↓
Building / Property
    ↓
Unit
    ↓
Unit Owner
    ↓
Published Listing
    ↓
Renter discovers unit
    ↓
Inquiry
    ↓
Viewing
    ↓
Application
    ↓
Owner approval
    ↓
Lease
    ↓
Move-in
    ↓
Monthly rent
    ↓
Utilities
    ↓
Maintenance
    ↓
Renewal / Move-out
```

That connects the **marketplace** to the **SaaS CRM**.

That connection is one of the biggest strengths of the product.

---

# 10. Free advertisement can become a SaaS customer

This creates your growth loop.

```text
Owner posts apartment FREE
           ↓
Gets renter inquiries
           ↓
Successfully rents apartment
           ↓
Ferio says:

"Manage this tenancy with Ferio Rental"
           ↓
Start subscription
           ↓
Lease
Billing
Utilities
Maintenance
Receipts
           ↓
Owner eventually adds more units
```

That is a far stronger product strategy than:

> “Buy SaaS first, then enter properties.”

---

# 11. Units can have individual utility structure

Your utility idea should be modeled properly.

A unit doesn't simply have:

```text
utilityCharge = 5000
```

Instead:

```text
Unit A-4
  │
  ├── Electricity
  │      └── Separate meter
  │
  ├── Gas
  │      └── Fixed ৳1,080
  │
  ├── Water
  │      └── Shared building bill
  │
  ├── Internet
  │      └── Tenant pays directly
  │
  ├── Lift
  │      └── Shared service charge
  │
  └── Security
         └── Shared monthly charge
```

So your domain should be:

```text
UtilityAccount
UtilityBill
UtilityBillItem
Meter
MeterReading
UtilityAllocation
```

---

# 12. One monthly statement can contain many bills

Example:

```text
Unit 4B
September 2026

Rent                             ৳35,000

UTILITIES
Electricity                       ৳3,210
Gas                               ৳1,080
Water                               ৳600
Internet                          ৳1,000

BUILDING CHARGES
Security                            ৳800
Lift                                ৳500
Cleaning                            ৳300
Service Charge                    ৳2,000
────────────────────────────────────────
Total                            ৳44,490
```

But ownership/payment routing may vary.

For example:

```text
Rent → Unit Owner
Electricity → Utility provider / owner
Internet → ISP
Building service charge → Building management
```

Ferio can show **one statement** while preserving multiple payable beneficiaries.

That is much more sophisticated than one invoice→one payee.

---

# 13. Building-level utility vs unit-level utility

Architecture:

```text
Building
│
├── Shared Electricity
├── Lift
├── Security
├── Cleaning
├── Generator
├── Water
│
└── Units
     │
     ├── Unit A
     │    ├── Own electricity meter
     │    ├── Own gas
     │    └── Building water allocation
     │
     └── Unit B
          ├── Own electricity meter
          └── Building water allocation
```

This should become a first-class billing engine.

---

# 14. Maintenance Crew

There are actually two types.

### Building maintenance

```text
Lift broken
Generator problem
Water pump
Common staircase
Security gate
Roof leak
```

Responsibility:

```text
Building Management
```

### Unit maintenance

```text
Bathroom leak
Bedroom electrical fault
Kitchen appliance
Unit paint
```

Responsibility may be:

```text
Unit Owner
or
Renter
```

according to the lease.

So maintenance tickets need:

```text
scope:
BUILDING
UNIT
COMMON_AREA

payer:
OWNER
RENTER
BUILDING_MANAGEMENT
SHARED
```

Then:

```text
Maintenance Request
       ↓
Triage
       ↓
Crew / Vendor
       ↓
Estimate
       ↓
Approval
       ↓
Work
       ↓
Cost
       ↓
Who Pays?
```

---

# 15. Marketplace is not only rental

This is another major change.

Ferio should actually become:

> **Property Marketplace + Rental Management SaaS**

Public listing types:

| Transaction | Property Type    |
| ----------- | ---------------- |
| Rent        | Apartment        |
| Rent        | House            |
| Rent        | Room             |
| Rent        | Shop             |
| Rent        | Office           |
| Rent        | Store Room       |
| Rent        | Warehouse        |
| Rent        | Commercial Space |
| Sale        | Apartment        |
| Sale        | House            |
| Sale        | Building         |
| Sale        | Land             |
| Sale        | Commercial       |
| Sale        | Shop             |

This should **not** be modeled with separate systems for each.

Use:

```text
PropertyListing

purpose:
RENT
SALE

assetType:
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

---

# 16. Property-for-sale listing

A sales listing could contain:

```text
Title
Description

Asking Price
Negotiable

Property Type

Area
Land Size

Bedrooms
Bathrooms

Address
Lat/Lng

Google Maps URL optional
OpenStreetMap coordinates

Images

Owner Sale
Broker Sale

Seller
Broker

Amenities

Legal Documents
Land Papers

Mutation / নামজারি
Khatiyan
Deed
Tax receipt
RAJUK documents
Other papers
```

But documents need visibility controls:

```text
PUBLIC
VERIFIED_USERS
INTERESTED_BUYERS
PRIVATE
ADMIN_ONLY
```

You **should not publish complete sensitive land papers publicly by default**.

---

# 17. Owner sale vs Broker sale

Listing:

```text
sellerType:

OWNER
BROKER
DEVELOPER
AGENCY
```

Example UI:

```text
৳ 2.4 Crore

5 Katha Residential Land
Bashundhara R/A

✓ Owner Posted
✓ Identity Verified
✓ Documents Available

[Contact Seller]
[Schedule Visit]
```

or:

```text
Broker Listing
Rahman Properties
```

---

# 18. Advertisements become their own bounded context

This is crucial.

Don't make:

```text
Unit == Listing
```

They are different.

A unit is operational inventory.

A listing is marketing.

```text
Unit
  ↓
Listing
```

A single unit may have:

```text
Listing #1 → Rent 2026
archived

Listing #2 → Rent 2027
active
```

Likewise, a free user may create:

```text
Listing
```

without creating a full managed `Unit`.

Later, when they subscribe:

```text
Listing
   ↓
Convert to Managed Property/Unit
```

Excellent onboarding flow.

---

# 19. So you actually have THREE user experiences

Not one admin application.

```text
                         FERIO

         ┌────────────────┼────────────────┐
         │                │                │
         ▼                ▼                ▼

 PUBLIC MARKETPLACE    SaaS APP        PLATFORM ADMIN

 renter/buyer         owners/managers   Ferio team
 broker               accountants
 free property owner  maintenance
                      staff
```

Potential URLs:

```text
www.ferio.com
```

Public marketplace.

```text
app.ferio.com
```

SaaS dashboard.

```text
admin.ferio.com
```

Ferio Platform Admin.

You could additionally have:

```text
owner.ferio.com
tenant.ferio.com
```

later, but don't fragment unnecessarily yet.

---

# 20. Subscription architecture

Subscription should belong to:

```text
Organization
```

not building and not user.

Example:

```text
Sheakh Properties
       │
       └── PRO Subscription
                │
                ├── 10 properties
                ├── 100 units
                ├── 5 staff
                ├── utilities
                ├── maintenance
                ├── accounting
                └── reports
```

Plans:

```text
FREE LISTING
────────────
Marketplace ads
Lead inbox

STARTER
────────────
5 managed units
Rental CRM
Basic billing

PRO
────────────
50 units
Staff
Utilities
Maintenance
Reports

BUSINESS
────────────
500 units
Advanced permission
Accounting
Automation
API

ENTERPRISE
────────────
Custom
```

---

# 21. Listing subscription and SaaS subscription are separate concepts

Very important:

```text
Free user
can post listing
```

does not mean:

```text
Free user
has free Property CRM
```

You might later monetize listings independently:

```text
Free Listing
Featured Listing
Urgent Listing
Homepage Boost
Verified Listing
```

while SaaS plans remain:

```text
Starter
Pro
Business
Enterprise
```

Two revenue streams.

---

# 22. Correct top-level domain architecture

I would now redesign the backend around:

```text
src/

platform/
  organizations/
  subscriptions/
  entitlements/
  platform-admin/

identity/
  users/
  profiles/
  permissions/

marketplace/
  listings/
  listing-media/
  listing-documents/
  listing-search/
  favorites/
  inquiries/
  viewings/
  moderation/

property/
  properties/
  buildings/
  units/
  ownership/

leasing/
  renters/
  applications/
  guarantors/
  leases/
  occupants/
  renewals/
  move-outs/

billing/
  billing-accounts/
  charges/
  invoices/
  payments/
  allocations/
  beneficiaries/
  deposits/
  ledger/

utilities/
  utility-accounts/
  utility-bills/
  meters/
  readings/
  allocations/

maintenance/
  requests/
  crews/
  vendors/
  work-orders/
  expenses/

crm/
  leads/
  conversations/
  activities/

documents/

notifications/

audit/

reports/

integrations/
```

Now the architecture actually represents your idea.

---

# 23. Biggest conceptual correction: there are 4 different “owners”

Don't use one vague `owner` everywhere.

You need to distinguish:

```text
Organization Owner
→ owns/administers SaaS workspace

Property Owner
→ owns property/building

Unit Owner
→ owns individual apartment/unit

Listing Owner/Seller
→ owns the marketplace advertisement
```

One person can fulfill several roles.

But they are different domain relationships.

---

# 24. Likewise “tenant” has two meanings — eliminate one

Do NOT use:

```text
Tenant
```

for SaaS tenancy.

Use:

```text
Organization
```

Then:

```text
Renter
```

for the person renting.

That gives clean terminology:

```text
Ferio Organization
Property Owner
Unit Owner
Renter
Broker
Maintenance Crew
Platform Admin
```

Far less confusion.

---

# 25. Correct product lifecycle

The whole product now becomes:

```text
                    PUBLIC MARKETPLACE

Owner/Broker
    ↓
Post Ad
    ↓
Listing
    ↓
Map/Search
    ↓
Renter/Buyer
    ↓
Inquiry
    ↓
Viewing
    ↓
──────────────────────────────────────────

              RENTAL CONVERSION

Renter applies
    ↓
Owner approves
    ↓
Lease
    ↓
Unit occupied

──────────────────────────────────────────

                  SaaS CRM

Monthly Rent
Utilities
Bills
Maintenance
Documents
Payments
Receipts
Renewal
Move-out

──────────────────────────────────────────

               SALE CONVERSION

Buyer inquiry
    ↓
Viewing
    ↓
Negotiation
    ↓
Seller/Broker contact
    ↓
Sale closes externally initially
```

You don't even need to process real-estate sale payments initially. Ferio can start as the marketplace/CRM layer.

---

# What Gemini built versus what you actually want

The current implementation already shows some of these nouns—marketplace, sale, shops, store rooms and map links have been added. ([Ferio Rental][2]) But structurally it still looks like **one property administrator's internal software**, because the navigation, organization identity and operator functions surround everything. ([Ferio Rental][1])

So I would **not ask Gemini to keep patching the existing UI page by page**.

The correction needs to happen first at:

```text
Product Model
      ↓
Domain Model
      ↓
SaaS Model
      ↓
Marketplace Model
      ↓
Permission Model
      ↓
Subscription Model
      ↓
Backend Schema
      ↓
API
      ↓
Frontend applications
```

Otherwise it will keep adding features to the wrong conceptual foundation.

### The product I now understand you want is:

> **Ferio is a Bangladesh-focused property marketplace where anyone can advertise property for rent or sale, renters/buyers can discover property geographically through OpenStreetMap, and professional property/building/unit owners can upgrade into a subscription SaaS that manages leasing, renters, unit-level ownership, direct owner rent collection, utilities, maintenance, documents, accounting and operations.**

That is a **much larger and much more coherent product** than the current “property operations dashboard.”

And yes — this materially changes the PRD and all three implementation schedules we created earlier. The next correct step is to rewrite the **master PRD around Marketplace + SaaS + Platform Admin**, then regenerate Release 1/2/3 schedules from that model rather than continuing from the old one.

[1]: https://mohammad.sheakh.qzz.io/ "Ferio Rental — Property & Lease Operations Platform"
[2]: https://mohammad.sheakh.qzz.io/search "Ferio Rental — Property & Lease Operations Platform"
[3]: https://mohammad.sheakh.qzz.io/owner "Ferio Rental — Property & Lease Operations Platform"



Yes — that clarifies it. What you’re describing is **multi-tenant SaaS with strong tenant isolation**, where each customer organization gets its own branded URL and its own database.

So instead of:

```text
app.ferio.com
  └── organizationId decides everything
```

you want more like:

```text
rahmanproperties.ferio.com
abcproperty.ferio.com
gulshanholdings.ferio.com
```

or even:

```text
rent.rahmanproperties.com
portal.abcproperty.com
```

and behind each URL, the backend resolves which SaaS tenant/organization is being accessed.

The stronger part of your requirement is:

```text
Tenant A
→ separate database

Tenant B
→ separate database

Tenant C
→ separate database
```

That is a valid SaaS architecture. It gives you much stronger isolation than a shared database with only `organizationId`.

For your case, I would model it like this:

```text
                        FERIO PLATFORM
                              │
                  Platform Control Plane DB
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼

rahman.ferio.com       abc.ferio.com         gulshan.ferio.com
        │                     │                     │
        ▼                     ▼                     ▼
   Tenant Resolver       Tenant Resolver       Tenant Resolver
        │                     │                     │
        ▼                     ▼                     ▼
 PostgreSQL DB A        PostgreSQL DB B        PostgreSQL DB C
```

The **control-plane database** should contain only platform-level data, such as:

```text
SaaS organizations
Tenant slug/domain
Subscription
Plan
Billing
Database connection metadata
Tenant status
Feature entitlements
Provisioning state
Platform audit
```

Then each tenant database contains the operational rental data:

```text
properties
buildings
units
owners
renters
leases
invoices
payments
utilities
maintenance
documents
staff
agents
reports
```

So for example:

```text
Control DB

Tenant:
id: tnt_123
name: Rahman Properties
slug: rahman
domain: rahman.ferio.com
plan: PRO
status: ACTIVE
databaseKey: tenant_rahman
```

Then:

```text
tenant_rahman database

Property
Building
Unit
Renter
Lease
Payment
...
```

This is what I would call **database-per-tenant multi-tenancy**.

One important terminology improvement: I would still use `Organization` or `Workspace` in product language and reserve `Tenant` for the SaaS architecture internally, because in property rental you already have real tenants/renters. Otherwise you end up with confusing code such as:

```ts
tenant.tenant.tenantId
```

A cleaner distinction is:

```text
SaaS Tenant = Organization
Rental Tenant = Renter
```

Internally you can still have:

```ts
SaasTenant
TenantDatabase
TenantDomain
```

for infrastructure concerns.

For URL resolution, NestJS can inspect:

```text
Host: rahman.ferio.com
```

then resolve:

```text
rahman
   ↓
SaasTenant
   ↓
database connection
```

Conceptually:

```ts
@Injectable()
export class TenantResolver {
  async resolveFromHost(host: string) {
    const subdomain = host.split('.')[0];

    return this.controlDb.saasTenant.findUnique({
      where: { slug: subdomain },
    });
  }
}
```

Then a request context carries:

```ts
{
  tenantId: 'tnt_123',
  tenantSlug: 'rahman',
  databaseKey: 'tenant_rahman'
}
```

and your Prisma layer connects to that tenant DB.

The provisioning flow should be:

```text
Platform Admin / Signup
        ↓
Create SaaS Tenant
        ↓
Choose slug

rahman.ferio.com
        ↓
Create PostgreSQL database
        ↓
Run Prisma migrations
        ↓
Seed default roles/settings
        ↓
Create organization owner
        ↓
Activate subscription
        ↓
Tenant LIVE
```

And suspension:

```text
Subscription expired
        ↓
Tenant status = SUSPENDED
        ↓
Database remains intact
        ↓
Read-only / blocked according to policy
```

You **do not delete their database**.

There is also an important distinction with your public marketplace.

I would keep the public marketplace **outside tenant databases**:

```text
                        FERIO

             ┌────────────┴────────────┐
             │                         │
      PUBLIC MARKETPLACE           SaaS TENANTS
             │                         │
      Marketplace DB           DB-per-tenant
```

Why?

Because a renter needs to search:

```text
Rampura
Gulshan
Bashundhara
```

across listings from **many different owners/organizations**.

If every listing lived only inside isolated tenant databases, marketplace search would require querying hundreds or thousands of databases.

That would be a poor architecture.

So use a **central marketplace database/index**:

```text
MarketplaceListing
ListingMedia
ListingLocation
SellerProfile
BrokerProfile
Inquiry
Favorite
```

When a SaaS tenant publishes Unit 4B:

```text
Tenant DB
Unit 4B
   ↓
Publish Listing
   ↓
Marketplace Listing Service
   ↓
Central Marketplace DB
```

The public search queries only that central marketplace.

So your final architecture becomes:

```text
                         FERIO PLATFORM

                     ┌──────────────────┐
                     │  Control Plane   │
                     │ Tenant/Plans/DBs │
                     └────────┬─────────┘
                              │

         ┌────────────────────┼────────────────────┐
         │                    │                    │

 PUBLIC MARKETPLACE      TENANT A SaaS        TENANT B SaaS
 central DB              rahman.ferio.com     abc.ferio.com
                         │                    │
                         DB A                 DB B

Marketplace contains:
Listings
Search
Map
Inquiries
Sale Ads
Rent Ads
Broker Ads

Tenant DB contains:
Properties
Units
Renters
Leases
Utilities
Maintenance
Accounting
Staff
```

That is much closer to the architecture you’re describing.

I would choose **database-per-tenant** for your design if your priorities are strong isolation, per-customer backup/restore, easier enterprise data separation, and custom domains. The tradeoff is that migrations, provisioning, monitoring, reporting across all tenants, and connection management become significantly more complex than a shared database model.

So the architecture needs a proper **control plane + tenant provisioning service + migration orchestrator**, not simply dynamic Prisma URLs scattered through request handlers.

This clarification materially changes the PRD again: the product should explicitly specify **Control Plane, Marketplace Plane, and Tenant Data Plane** as three separate architectural layers.

---

# 26. Paid listing promotions — advertisers pay Ferio for priority

Free ads stay free forever. But an advertiser who wants more visibility can **pay Ferio directly** to boost an advertisement. This is revenue stream #2 and it is completely separate from SaaS subscriptions and from rent (see §11 / money-flow separation):

```text
Advertiser ──── promotion fee ────→ FERIO
```

## Promotion products

```text
FEATURED
─────
Listing pinned above free results
"Featured" badge on card + map chip
Highlighted card treatment

URGENT
──────
"Urgent" badge (moving-out / last-date urgency)
Slight rank lift within normal results

TOP_SEARCH (Homepage Spotlight)
──────────────────────────────
Eligible for homepage hero/spotlight slot
Highest search rank weight
```

## What paying buys (extra functionality, not just placement)

```text
Priority ranking        → promoted listings appear above free ones
Badge + styling         → visible trust/urgency marker on cards & markers
Promotion window        → fixed duration (e.g. 7 / 15 / 30 days), auto-expiry
Performance stats       → inquiry count during promotion period
Manageable lifecycle    → purchase → pay → active → expire/renew/cancel
Platform control        → admin can view, revoke, refund-flag, set pricing
```

## Purchase lifecycle

```text
Advertiser picks promotion on own listing
      ↓
Promotion order created (PENDING_PAYMENT)
      ↓
Pay via bKash/Nagad/bank (manual confirmation initially)
      ↓
ACTIVE — listing gets badge + rank boost from startsAt to expiresAt
      ↓
Auto-expiry scan flips EXPIRED and removes badge/rank
```

Rules:

```text
Only the listing owner can promote their own listing
One ACTIVE promotion per type per listing (renew extends expiry)
Expired ≠ deleted — history retained for reporting/audit
Moderation still applies — PENDING_REVIEW/REJECTED listings cannot be promoted
Money recorded in the MARKETPLACE plane ledger — never merged with rent
```

---

# 27. Rich unit detail — room-by-room, feet by feet

When someone adds a unit so renters can find it, a single "2 bed / 2 bath" summary is not enough. Each unit should be described **room by room**, with per-room photos, dimensions and descriptions:

```text
Unit 4B — 1,250 sqft
│
├── Master Bedroom     14'0" × 12'0"   attached bath, 2 photos
├── Bedroom 2          11'0" × 10'6"   balcony access, 3 photos
├── Living / Dining    18'0" × 13'0"   south-facing, 4 photos
├── Kitchen             9'0" ×  8'0"   fitted cabinets, gas line, 2 photos
├── Bathroom (common)   7'6" ×  5'0"   geyser installed, 1 photo
└── Balcony             6'0" ×  4'0"   city view, 1 photo
```

So the domain gains:

```text
UnitRoom            name, type, lengthFt, widthFt, description, sortOrder
UnitRoomMedia       photo URLs registered against a specific room
```

Room types:

```text
BEDROOM · MASTER_BEDROOM · BATHROOM · KITCHEN · LIVING_ROOM
DINING_ROOM · BALCONY · SERVANT_ROOM · STORAGE · GARAGE · OTHER
```

This detail must survive the cross-plane publish:

```text
Tenant DB Unit
   └── UnitRooms (+ media)
          ↓ publish (outbox projection)
Marketplace Listing carries rooms[]
          ↓
Public detail page renders room-by-room gallery w/ dimensions
```

Renters get real information ("is my king bed fitting that bedroom?", "how big is the kitchen?") without contacting anyone — which increases qualified inquiries and reduces wasted viewings. Free-advertisers' marketplace listings get the same room-by-room structure, so every ad on Ferio is rich, not only SaaS-published units.
