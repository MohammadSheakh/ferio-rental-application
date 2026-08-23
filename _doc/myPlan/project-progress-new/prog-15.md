# Progress Report 15 — Admin TOTP UX (QR + Second Step) & Per-Resource Scope ACLs

**Date:** 2026-08-23
**Role:** Senior Solution Architect & Fullstack Engineer
**Status:** Completed — 11/11 live assertions; admin console gains full 2FA self-service, tenant reads/writes now honour per-resource membership scopes

---

## Executive Overview

Completed the two items flagged in prog-13/14:

1. **Admin-web TOTP UX** — staff sign-in now handles the second factor (auto-detected "TOTP code required" step), and a new **Security tab** provides full self-service enrollment with QR code.
2. **Per-resource scope ACLs** — `scopePropertyIds / scopeBuildingIds / scopeUnitIds` are now **enforced**, not just stored: scoped members see and touch only their slice of the portfolio.

---

## 1. Staff TOTP UX (`ferio-admin-web`)

### Login
- Password submit → if backend answers *"Valid TOTP code required"*, the form transitions to a **6-digit code step** (monospace, letter-spaced) with an escape hatch back to credentials.

### Security tab (new)
| State | UX |
|---|---|
| Not enrolled | "Enable two-factor" → calls setup → renders **QR code** (`qrcode` → data-URL from the otpauth URI) + manual base32 key |
| Pending | Code entry (6-digit, auto-sanitised) → confirm |
| Enrolled | Status line + disable-with-current-code |

New backend endpoint: `GET /identity/platform/totp/status` (PlatformAdminGuard) for console state polling. Verified: status false→setup→confirm→status true ✓.

## 2. Per-Resource Scope ACLs

`member-scope.ts` semantics:
- **Workspace-wide roles** (`ORGANIZATION_OWNER`, `PROPERTY_MANAGER`) always see everything.
- All other roles: empty scope arrays = unrestricted (role gates still apply); **any non-empty array = restricted to the union** of listed properties ∪ buildings ∪ units.
- `inScope(target)` matches direct property id, unit id, building id or owning property id; `assertInScope` for single-resource endpoints; `filterByScope` for collections.

Wired into:
- `GET /tenant/properties` — filtered
- `GET /tenant/units` — filtered (unit id, building, or owning property match)
- `GET /tenant/properties/:id` — assertion before return

Verified live: VIEWER scoped to one property sees **1 of 6 properties** and only that property's units; workspace-wide owner unaffected.

## 3. Session Notes

- Root-caused a flaky verification to a **stale server process** racing rebuilds; fresh restart resolved it. Launch pattern standardised on `setsid --fork`.
- Fixed `a && ok() || bad()` assertion precedence bugs in the verify script (now explicit ifs).
- Invite e-mail tagging corrected (`+tag` must stay in the local part).

## 4. Remaining Next Steps

1. Documents & notices models for renter surface; PWA shell (Week 28 tail).
2. Broker CRM groundwork (Week 30).
3. TOTP: backup/recovery codes.

---

*Progress chain: prog-08 … prog-14 → **prog-15 (2FA UX complete + scope ACLs enforced)**.*
