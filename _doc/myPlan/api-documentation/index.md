# API Documentation — Ferio Property Platform

**Version:** 2.2 · **Base URL:** `http://localhost:6733/api/v1`
**Auth:** Bearer JWT (`Authorization: Bearer <token>`) · **Content-Type:** `application/json`

---

## Role Index

| # | Role | Surface | Auth | Doc File |
|---|---|---|---|---|
| 1 | Marketplace Visitor / Renter / Seller | ferio.com (port 3001) | Optional JWT | [marketplace-renter_role](marketplace-renter_role/index.md) |
| 2 | SaaS Workspace Owner / Staff | app.ferio.com (port 3000) | JWT + Membership | [saas-workspace_owner_role](saas-workspace_owner_role/index.md) |
| 3 | Renter (My Rental) | ferio.com/renter | JWT (identity-bound) | [rental-portal_renter_role](rental-portal_renter_role/index.md) |
| 4 | Unit Owner | saas-web/owner | JWT (ownership-bound) | [owner-portal_owner_role](owner-portal_owner_role/index.md) |
| 5 | Platform Admin | admin.ferio.com (port 3002) | Staff JWT + RBAC + TOTP | [platform-admin_admin_role](platform-admin_admin_role/index.md) |
| 6 | External Integration | /external/v1 | API Key (fk_live_…) | [external-api_integration_role](external-api_integration_role/index.md) |

---

## Authentication

All roles share a single central identity. One login across marketplace and SaaS.

```http
POST /identity/register          → Create account
POST /identity/login             → Email + password login
POST /identity/google            → Google Sign-In
POST /identity/refresh           → Rotate refresh token
POST /identity/logout            → Revoke refresh token
GET  /identity/me                → Current profile
GET  /identity/my/organizations  → List my workspaces
```

---

## Money Flow Separation

Four distinct ledgers — never merged:

```
1. Organization ──── subscription fee ───→ Ferio        (control plane)
2. Renter ────────── rent ───────────────→ Unit Owner   (tenant plane)
3. Advertiser ────── promotion fee ──────→ Ferio        (marketplace plane)
4. Gateway payment ─ online checkout ────→ Ferio        (control plane)
```
