# Progress Report 13 — Staff TOTP, Domain RBAC Gates & Renter Portal Foundation

**Date:** 2026-08-23
**Role:** Senior Solution Architect & Fullstack Engineer
**Status:** Completed — 19/19 live assertions across three new capability areas

---

## Executive Overview

Hardened the platform on two security axes and opened the **fourth user surface**:

1. **Staff TOTP (RFC-6238)** — self-contained implementation, full enroll→enforce→disable lifecycle.
2. **Domain-scoped member RBAC** — every tenant mutation now passes a role gate derived from the caller's ACTIVE `Member` row.
3. **Renter Portal foundation (Week 28)** — identity-bound renters can view their tenancy, statements, beneficiary payment instructions and report payments into the verification queue.

---

## 1. Staff TOTP (`/identity/platform/totp/*`)

- Zero-dependency RFC-6238 module (`identity/totp.ts`): HMAC-SHA1 over base32 secrets, 6 digits / 30s step, **±1 step drift tolerance**, constant-time comparison, `otpauth://` URI for Google Authenticator & friends. (otplib v13 was evaluated but moved to a plugin architecture; ~60 lines of node:crypto is the durable choice.)
- Lifecycle: `setup` provisions a pending secret → `confirm {code}` enables enforcement → staff login then **requires a valid code** → `disable {code}` clears enrollment.
- Verified: confirm ✓ · login without code blocked ✓ · login with fresh code ✓ · disable ✓ · plain login restored ✓

## 2. Member-Domain RBAC (tenant plane)

- `ActiveMemberGuard` (class-level on `/tenant/*`): resolves the caller's ACTIVE membership in the resolved organization; non-members get 403 on **every** route including reads.
- `DomainWriteGuard` + `@RequireMemberDomain(...)`: applied to **24 mutation routes**, mapping domains to roles:

| Domain | Write roles |
|---|---|
| inventory (properties/buildings/units/ownership/publish) | ORGANIZATION_OWNER · PROPERTY_MANAGER · BUILDING_MANAGER |
| billing | + ACCOUNTANT |
| leasing (renters/leases) | + LEASING_OFFICER |
| maintenance | + MAINTENANCE_MANAGER · CARETAKER |

- Verified: owner writes ✓ · ACCOUNTANT inventory write 403 with clear message ✓ · ACCOUNTANT reads 200 ✓ · outsider read 403 ✓

## 3. Renter Portal (Week 28 foundation)

New `renter-portal` feature module — the renter is **not** a workspace member; resolution fans out across ACTIVE tenant DBs matching `Renter.centralUserId` with an ACTIVE lease.

| Endpoint | Returns |
|---|---|
| `GET /renter/me` | tenancy snapshot: lease dates/rent, unit+property, outstanding total, and **per-owner payment instructions** (bKash/Nagad/bank + share %) |
| `GET /renter/invoices` | statements incl. lines and payments with receipt numbers |
| `POST /renter/payments` | reports a direct payment → enters staff verification queue (never auto-paid) |

Supporting fixes: `CreateTenantRenterDto` gained `centralUserId`/`nidNumber`; `createRenter` persists the identity link.

## 4. Verification

`test/prog13.verify.ts` — **19 passed / 0 failed**, fully idempotent (resets staff TOTP state first).

## 5. Session Notes

- Nest method-level `@UseGuards` *replaces* class guards — caught after gated routes silently lost JWT auth; now chained explicitly.
- otplib v13's plugin API was replaced by the in-house TOTP module; dependency removed.
- Scratch environment unchanged (`ferio-pg-gis` :5498, `ferio-pg-test` :5499). Test API instance stopped after runs.

## 6. Remaining Next Steps

1. QR-code rendering for TOTP setup in admin-web (otpauth URI already returned).
2. Per-resource scope-array enforcement (property/building/unit ACLs) beyond role gates.
3. Renter Portal PWA UI + utilities/maintenance/notices sections (Week 28 remainder).
4. Broker CRM (Week 30) groundwork.

---

*Progress chain: prog-08 … prog-12 → **prog-13 (TOTP + domain RBAC + renter portal foundation)**.*
