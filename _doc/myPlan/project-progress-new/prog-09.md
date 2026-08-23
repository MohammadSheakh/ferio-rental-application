# Progress Report 09 — Marketplace Web: Production Wiring + Live PostGIS Smoke Test

**Date:** 2026-08-22
**Role:** Senior Solution Architect & Fullstack Engineer
**Status:** Completed — `ferio-marketplace-web` fully wired to the real API, verified end-to-end against a live PostGIS instance

---

## Executive Overview

Connected the public marketplace frontend (`www.ferio.com` surface) to the real three-plane backend for the first time. Previously all four web apps were hardcoded mocks with broken fetch calls (wrong port, wrong paths). The marketplace now performs **real geospatial search** against the PostGIS-backed marketplace plane, following `_doc/design-language.md` throughout.

---

## 1. Frontend Implementation (`ferio-marketplace-web`)

### 1.1 Typed API Client (`lib/api.ts`)
- Base URL via `NEXT_PUBLIC_API_URL` (default local dev), `.env.example` added.
- Full contracts: `ListingCard`, `ListingDetail`, `SearchResult`, `MapMarker`.
- Unwraps the backend's global `{ success, data }` interceptor envelope in one place.
- Endpoints: `/marketplace/listings/search`, `/marketplace/listings/map`, `/marketplace/listings/:id`.

### 1.2 Home Page — Real Search (design language compliant)
- Filters wired to the live query engine: purpose pills, asset-type chips (8 categories), area text, min/max ৳ price, bedrooms.
- Pagination with real totals; grayscale loading skeletons; calm empty/error states ("The marketplace service is not responding. Start the API on port 6733…") per §6/§8.
- Image-first cards, no borders/shadows; category label → title → area → price hierarchy.

### 1.3 OpenStreetMap View (`components/FerioMap.tsx`)
- **react-leaflet 5 + Leaflet** with OSM raster tiles (attribution included).
- Markers are solid-black **price chips** (৳ formatted k/L/Cr) — divIcons matching the design language's chip pattern; no colored pins.
- **Viewport-driven search**: on `moveend`, the component reports bounds and the page fetches `/marketplace/listings/map?minLat…maxLng`, so panning IS searching (PostGIS `&&` envelope).
- Client-only via `next/dynamic({ ssr:false })`; "Open in OpenStreetMap" deep link from current bounds.

### 1.4 Listing Detail Page (`app/listings/[id]/page.tsx`)
- Gallery (cover + thumbnail switcher), specs as hairline-divided rows, amenity chips, description.
- **Documents section renders only what the server's visibility rules allow** for the current viewer (anonymous → PUBLIC only).
- Seller card: identity-verified badge (muted semantic emerald), direct call/email actions when present, plain-voice safety note ("Never pay before visiting the property in person").
- Location card linking to OSM at the listing coordinates.

## 2. Live End-to-End Verification (real PostGIS)

| Step | Result |
|---|---|
| `postgis/postgis:16-3.4` container on :5498 | ✅ |
| Control + marketplace schema push via per-plane configs | ✅ |
| `001_postgis_location.sql` applied live (extension, generated geometry, GiST) | ✅ |
| Demo seed script (`prisma/scripts/seed-marketplace-demo.ts`) — 8 Dhaka listings (Rampura/Gulshan/Banani/Motijheel/Tejgaon/Uttara/Bashundhara/Mirpur) | ✅ geometry populated ×8 |
| Plain search `GET /listings/search` | ✅ total 8, envelope intact |
| Radius `?lat=23.7509&lng=90.4047&radiusKm=3&sortBy=nearest` | ✅ 3 hits ordered 0 / 1.27 / 2.76 km (`ST_DWithin` + `<->` KNN live) |
| Map bbox `23.70–23.82 / 90.36–90.43` | ✅ 7 markers — Uttara correctly excluded by viewport |
| Detail endpoint as anonymous | ✅ 0 documents visible, seller phone exposed |

Test instance ran on port **6799** (see §3); stopped after verification.

## 3. Environment Fixes Discovered During Live Run

| Issue | Resolution |
|---|---|
| Prisma 7 rejects `url = env(...)` in **all** schema files at generate time (not just planes) | Removed from legacy datasource source (`prisma/schema/base/datasource.prisma`) and generated `prisma/schema.prisma` |
| Generated plane clients require runtime package missing under pnpm strictness | Added `@prisma/client-runtime-utils` to backend deps |
| Legacy `.prisma/client` generation wiped by dependency changes | Re-ran `npx prisma generate` (legacy config) |
| Ports 6733 **and** 6734 occupied by the user's other project (`e-com-nextjs/ferio-nest-prisma` dev server) — left untouched | Smoke test used port 6799 |

## 4. Design Language Compliance

- Grayscale structure; semantic color only for the verified badge (pale emerald).
- Pill buttons via existing `btn-pill-primary/secondary` tokens; hairlines instead of boxed shadows.
- Eyebrow labels used sparingly (hero, section headers only); Inter single-family hierarchy already global.
- Map chips follow the "solid-black discount chip" pattern from §6.
- One-sentence test passes: every new screen is fully legible in black/white/gray.

## 5. Remaining Next Steps

1. **`ferio-saas-web` wiring** — tenant-plane API client (`X-Tenant-Slug` header + `x-actor-id`), properties/units/billing pages onto real endpoints.
2. **`ferio-admin-web` wiring** — organizations/provisioning/migration/moderation console onto platform routes.
3. Posting + inquiry flows need the §10 auth architecture (identity → marketplace account binding).
4. Clustered markers / radius-draw controls on the map (v2 polish).

---

*Scratch environment still available: `ferio-pg-test` (plain PG :5499), `ferio-pg-gis` (PostGIS :5498).*
