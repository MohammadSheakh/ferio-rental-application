-- ──────────────────────────────────────────────────────────────
-- FERIO MARKETPLACE — 005: search hardening (§ P2 review)
-- pg_trgm + GIN indexes so ILIKE '%term%' area/district filters stop
-- degrading to sequential scans as listings grow. Also adds the
-- SearchEvent retention helper index.
-- ──────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "PropertyListing_area_trgm_idx"
  ON "PropertyListing" USING GIN ("area" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "PropertyListing_district_trgm_idx"
  ON "PropertyListing" USING GIN ("district" gin_trgm_ops);
