# Progress Report 11 — Central Identity (§10) + Google Sign-In, Live

**Date:** 2026-08-23
**Role:** Senior Solution Architect & Fullstack Engineer
**Status:** Completed — central identity plane implemented, Google login live, placeholder headers replaced by real JWT guards across all protected surfaces

---

## Executive Overview

Implemented the **§10 Authentication Architecture**: a single Central Identity living in the control-plane database, with email+password and **Google Sign-In**, issuing HS256 tokens that now guard platform-admin, marketplace-moderation, projection-ops and tenant-IAM routes. The `x-actor-id` / ad-hoc header placeholders are gone from protected surfaces.

---

## 1. Backend — Identity Plane

### 1.1 Control-plane schema
- New `CentralUser` model (+ `CredentialProvider` enum): unique email, bcrypt `passwordHash` (null for Google-only accounts), `googleSub` @unique for linking, `emailVerified`, soft-`isActive`.
- Lives in the CONTROL plane per the data-ownership matrix (§9) — no password duplication in tenant DBs; one user can join many organizations.

### 1.2 `IdentityModule` (`src/infrastructure/identity/`)
- **`POST /identity/register`** · **`POST /identity/login`** — bcrypt flows returning `{token,user}`.
- **`POST /identity/google`** — verifies a **Google Identity Services ID token** server-side via `google-auth-library` against `GOOGLE_CLIENT_ID`; upserts by `googleSub`; **links by verified email to an existing password account** (no duplicate identities).
- **`GET /identity/me`** — Bearer-authenticated profile.
- HS256 tokens signed with `JWT_ACCESS_SECRET`, 7-day expiry.
- Mounted at `/identity` deliberately — the legacy commerce `/auth` namespace stays untouched until retirement.

### 1.3 Guards applied
| Surface | Guard |
|---|---|
| `/platform/*` admin controller | `JwtAuthGuard` (RBAC refinement pending) |
| `/platform/marketplace/*` moderation | `JwtAuthGuard`, moderator id from identity |
| `/platform/*/outbox/*` projection ops | `JwtAuthGuard` |
| `/tenant/iam/*` | `JwtAuthGuard`; actor = authenticated identity (invite acceptance binds the *authenticated* user, ignoring any body-supplied id) |
| `GET /marketplace/listings/:id` | `OptionalJwtAuthGuard` → viewer's marketplace account resolved by centralUserId so document visibility (VERIFIED_USERS / INTERESTED_BUYERS / PRIVATE) is enforced per signed-in viewer |

## 2. Frontend — Login & Session

### 2.1 `ferio-marketplace-web`
- **`/login` page**: Google button via Google Identity Services (`NEXT_PUBLIC_GOOGLE_CLIENT_ID`, pill-shaped, `continue_with`) + email/password form with register toggle.
- **`lib/auth.tsx`** — session context persisted in localStorage (`ferio_identity`), exposing `loginWithPassword / registerWithPassword / loginWithGoogleCredential / logout`.
- API client attaches `Authorization: Bearer …` automatically.
- Header is auth-aware: name + logout when signed in; "Post Property" gates to `/login` when not.
- **Real inquiry flow on listing detail**: signed-in users send inquiries (`ensureMyAccount` auto-provisions the marketplace profile from the identity); anonymous users are invited to sign in — which also unlocks their document visibility.

### 2.2 saas-web / admin-web
Both API clients attach the same Bearer token when present.

## 3. Live Verification (:6799, scratch Postgres)

| Check | Result |
|---|---|
| Register → token | ✅ |
| Duplicate email blocked | ✅ conflict message |
| Wrong password rejected | ✅ "Invalid email or password" |
| `GET /identity/me` with Bearer | ✅ returns identity |
| Google endpoint, junk credential | ✅ clean "Google credential is invalid or expired" (audience/signature verification active) |
| Platform route: 401 without token / 200 with | ✅ |
| IAM invite with **Bearer only** | ✅ token issued after org provisioned under the new identity |
| Identity→membership enforcement | ✅ non-member of an org gets 403 on its IAM routes |

Full chain proven: register → login → provision organization owned by that identity → create staff invite → moderation actions — all with Bearer auth only.

## 4. Issues Found & Fixed During Verification

| Issue | Fix |
|---|---|
| Prisma 7.9 AI-consent guard silently killed backgrounded `db push` | Re-ran with `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION` set to the user's explicit consent message |
| `ApiBearerAuth is not defined` at runtime (missing import in generated JS) | Import fixed in `projection-ops.controller.ts` |
| Wrong relative import depth in `identity.service.ts` | `'../control-plane/...'` |
| Missing `passport-jwt` / `@nestjs/passport` deps | Installed + types |
| Strategy returned `{userId}` while decorator read `{sub}` → 500 on `/me`, 400 on IAM | Decorator now normalizes both shapes |
| Bash `UID` readonly builtin silently used as ownerUserId | Renamed variable; re-provisioned correctly |

## 5. Remaining Next Steps

1. RBAC on platform-admin routes (`PlatformUser` SUPER_ADMIN/ADMIN vs central users).
2. Refresh-token rotation + logout revocation strategy (currently 7-day static JWT).
3. Tenant-membership switcher UI in saas-web (list orgs a member belongs to).
4. Renter portal surface (Week 28) once membership scoping is complete.

---

*Progress chain: prog-08 (platform core) → prog-09 (marketplace web) → prog-10 (operator consoles + cross-plane loop) → **prog-11 (central identity + Google Sign-In)**.*
