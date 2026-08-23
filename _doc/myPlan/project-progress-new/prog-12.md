# Progress Report 12 — Platform RBAC, Refresh-Token Rotation & Organization Switcher

**Date:** 2026-08-23
**Role:** Senior Solution Architect & Fullstack Engineer
**Status:** Completed — staff-only RBAC on all platform surfaces, single-use refresh-token family with replay detection, and a live membership-driven organization switcher in the SaaS app

---

## Executive Overview

Closed the three gaps flagged at the end of prog-11:

1. **Platform-admin routes are now staff-only** — central-user tokens are rejected with an explicit "sign in at `/identity/platform/login`" error, and `PlatformUser` roles (`SUPER_ADMIN`/`ADMIN`/`SUPPORT`/`MODERATOR`) gate specific surfaces.
2. **Refresh-token rotation with replay detection** — sessions no longer rely on a static 7-day JWT.
3. **Organization switcher** — the SaaS sidebar now lists the signed-in identity's real memberships (cross-DB fan-out) and switching organizations re-targets every API call.

---

## 1. Platform RBAC

### 1.1 Staff realm
- `POST /identity/platform/login` authenticates against the control-plane `PlatformUser` table. Legacy plaintext passwords are accepted **once** and transparently upgraded to bcrypt hashes.
- Issues a **12-hour** token carrying `{sub, email, realm:'platform', role}`.

### 1.2 `PlatformAdminGuard` + `@PlatformRoles()`
- Replaces the plain guard on `PlatformAdminController`, marketplace-moderation controller and projection-ops controller.
- Rejects non-platform tokens (`403 Platform staff token required`) and enforces role metadata; `SUPER_ADMIN` bypasses role checks.

| Route surface | Required roles |
|---|---|
| `/platform/*` admin (orgs, plans, flags, tenant-DB ops) | SUPER_ADMIN, ADMIN |
| `/platform/marketplace/*` moderation | SUPER_ADMIN, ADMIN, MODERATOR |

### 1.3 Bootstrap tooling
`prisma/scripts/create-platform-admin.ts <email> <password> <name> [role]` — upserts staff with bcrypt hashing.

## 2. Refresh-Token Rotation & Logout

- Control-plane `RefreshToken` model stores **only sha256 hashes** of opaque 48-byte tokens (30-day expiry).
- Login/register/Google now return `{token, refreshToken, user}`; access tokens shortened to **30 minutes** (platform: 12h).
- **Single-use rotation**: `POST /identity/refresh` revokes the presented token and issues the next pair.
- **Replay detection**: presenting an already-rotated token revokes the user's entire refresh family ("Refresh token reuse detected — all sessions revoked").
- `POST /identity/logout` revokes the presented refresh token.
- Marketplace-web client: on any 401 it rotates once and replays the request; failed rotation drops the local session. Logout calls the revoke endpoint best-effort.

## 3. Organization Switcher (saas-web)

- New `GET /identity/my/organizations`: fans out across ACTIVE tenants' databases to collect memberships for the authenticated identity (same resilient pattern as cron scans).
- Sidebar selector now renders real memberships with role captions (`ORGANIZATION_OWNER`, …); selection persists locally and re-targets the `X-Tenant-Slug` header for every subsequent call.

## 4. Live Verification (:6799, scratch Postgres)

| Check | Result |
|---|---|
| Central token → platform route | ✅ 403 "Platform staff token required" |
| SUPER_ADMIN → `/platform/organizations` | ✅ 200 |
| MODERATOR → org admin | ✅ 403 (role) |
| MODERATOR → moderation queue | ✅ 200 |
| Refresh rotate → new pair | ✅ |
| Replay of rotated token | ✅ 401 + whole family revoked |
| Successor token after family kill | ✅ 401 |
| `my/organizations` | ✅ Sheakh Family Properties · ORGANIZATION_OWNER |
| Post-logout reuse | ✅ 401 |

## 5. Issues Found & Fixed

| Issue | Fix |
|---|---|
| Shared constants block lost during patching → `ACCESS_TTL is not defined` | New `identity.constants.ts` (loads dotenv itself) used by module, strategy and service |
| Secret mismatch risk between JwtModule registration and passport strategy | Both resolve `JWT_SECRET` from one place |
| Missing crypto import → `createHash/randomBytes is not defined` | Import restored |
| Platform tokens rejected: payload used `userId`, strategy required `sub`; strategy also stripped `realm/role` | Platform payload includes `sub`; strategy now passes the full signed payload through |

## 6. Remaining Next Steps

1. TOTP enforcement for staff login (`PlatformUser.totp*` fields exist; Week 27-era hardening).
2. Membership-scoped ACL enforcement inside tenant resources (property/building/unit scope arrays).
3. Renter portal (Week 28) — auth primitives are now in place for it.

---

*Progress chain: prog-08 → prog-09 → prog-10 → prog-11 (identity) → **prog-12 (RBAC + sessions + org switcher)**.*
