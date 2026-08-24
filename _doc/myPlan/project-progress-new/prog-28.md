# Progress Report 28 — §13 Secure Uploads: S3 Pipeline + Post-Property UI

**Date:** 2026-08-24
**Role:** Senior Solution Architect & Full-Stack Developer
**Status:** Completed — prog28 11/11; full regression battery **11 suites / 114 assertions** green

---

## Executive Summary

Closed the last 🔴 production blocker from the assessment: a **real file upload pipeline** backed by S3-compatible object storage, wired into both planes, and surfaced in a brand-new **Post Property** page (photos + room-by-room editor) on ferio.com.

## 1. Storage Infrastructure (`src/infrastructure/storage/`)

One contract, two drivers, chosen by `STORAGE_DRIVER`:

| Driver | Config | Use |
|---|---|---|
| `s3` | `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, optional `S3_ENDPOINT` (MinIO/R2/Spaces path-style), `S3_PUBLIC_BASE_URL` | production |
| `local` | `STORAGE_LOCAL_DIR`, `STORAGE_PUBLIC_URL` | dev/scratch — served at `/uploads` via express static |

Guarantees:
- **Mime allowlist** — images: jpeg/png/webp ≤5MB · documents: pdf/jpeg/png ≤10MB (400 on violation)
- **Size guard** — multer limits + service re-check (413)
- **Organized keys** — `images/YYYY/MM/<ts>-<hex>.<ext>`
- JWT-gated endpoints only; anonymous uploads rejected

## 2. Endpoints

Marketplace plane (`/marketplace/uploads/images|documents`, JWT) and tenant plane (`/tenant/uploads/images`, JWT + ActiveMemberGuard). Returned URLs register against the existing URL-based fields: listing media/documents, room photos, maintenance `photoUrls[]`, payment proofs, meter photos.

## 3. Frontend — `/post` page (ferio-marketplace-web)

The header's "Post Property" link finally has a destination:
- Auth-gated free-ad flow (no subscription CTA anywhere except post-submit conversion note)
- Basics form (purpose toggle, category, price, location, specs)
- Multi-photo upload with optimistic thumbnails, cover marking, remove
- **Room-by-room editor** (§24): name/type/ft×ft/note + per-room photos
- Submit → listing (PENDING_REVIEW) + media rows + rooms w/ media in one pass

## 4. Issues Found En Route

| Issue | Fix |
|---|---|
| `require('express')` unresolvable under pnpm strictness → API failed to boot | added `express` as direct dependency |
| TenantUploadController had `ActiveMemberGuard` without `JwtAuthGuard` first — the recurring Nest guard-chaining trap ("Sign-in required") | chained explicitly |

## 5. Verification (prog28.verify.ts)

Anonymous blocked · image+pdf uploaded & served back with correct content-types · wrong mime 400 · oversized 413 · URLs registered as listing cover + room photo and served through public detail · tenant-plane member upload. **11/11.**

Regression battery (fresh API): prog13 19 · prog14 5 · prog17 11 · prog18 4 · prog19 10 · prog20 9 · prog21 9 · prog22 5 · prog26 21 · prog27 10 · prog28 11 = **114/114 ✅**

Builds: ferio-nest-prisma ✅ · ferio-marketplace-web ✅ (`/post` route live)

## 6. Remaining Next Steps

1. Platform billing (W27) — collect subscription payments for self-serve provisioning.
2. LedgerEntry double-entry posting + utility allocation math (R2 financial gaps).
3. External API/webhooks surface (W33); custom domains (W26).
4. Promotion picker inside `/post` success screen ("Boost this ad").

---

*Progress chain: … prog-27 → **prog-28 (§13 secure uploads complete)**.*
