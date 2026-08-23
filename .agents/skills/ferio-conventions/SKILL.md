---
name: ferio-conventions
description: Ferio naming rules, plane boundaries, money-flow separation and the "Do Not Do This" list. Apply when writing domain code, creating models, naming services, or reviewing PRs in this project.
---

# Ferio Conventions

## Naming Rules (non-negotiable)

```text
SaaS Tenant = Organization        ← never "Tenant" in domain code
Rental occupant = Renter          ← never "Tenant" for the person renting
Unit Owner = UnitOwnership row    ← never assume Building Owner == Unit Owner
Listing Owner = sellerAccountId   ← marketplace advertisement owner
```

Four distinct "owners" — never conflate:
1. **Organization Owner** — owns/administers SaaS workspace
2. **Property Owner** — owns property/building (`PropertyOwnership`)
3. **Unit Owner** — owns individual unit (`UnitOwnership`)
4. **Listing Seller** — owns the marketplace advertisement

## Three Planes

| Plane | Database | Contains |
|---|---|---|
| Control Plane | `ferio_control` | CentralUser, organizations, subscriptions, tenant DB registry, automations |
| Marketplace Plane | `ferio_marketplace` | Public listings, offers, inquiries, moderation |
| Tenant Data Plane | `tenant_<slug>` per org | Properties, units, leases, billing, maintenance |

Every backend request must resolve: which plane → which org → which DB → which actor → which membership → what scope.

## Do Not Do This

- ❌ One shared operational DB if DB-per-tenant is required
- ❌ Query tenant DBs for marketplace search
- ❌ Create Prisma client per request
- ❌ Let frontend select database
- ❌ Put DB URL in JWT
- ❌ Make Listing equal Unit
- ❌ Assume Building Owner equals Unit Owner
- ❌ Route all rent through Ferio
- ❌ Mix subscription billing with rental billing
- ❌ Expose sale documents publicly by default
- ❌ Perform unsafe synchronous cross-DB dual writes
- ❌ Migrate all tenant DBs without concurrency controls
- ❌ Delete tenant DB immediately on missed subscription
- ❌ Introduce microservices without a measured need

## Money Flow Separation

Never merge these four payment ledgers:
1. Organization → Ferio (subscription fee)
2. Renter → Unit Owner (rent)
3. Renter → Building Management (service charge)
4. Advertiser → Ferio (boost/featured fees)

## Domain Write Gates

Mutation routes are gated by `@RequireMemberDomain()`:

| Domain | Roles allowed to write |
|---|---|
| inventory | ORGANIZATION_OWNER, PROPERTY_MANAGER, BUILDING_MANAGER |
| billing | + ACCOUNTANT |
| leasing | + LEASING_OFFICER |
| maintenance | + MAINTENANCE_MANAGER, CARETAKER |
