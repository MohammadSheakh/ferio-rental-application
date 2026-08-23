-- ──────────────────────────────────────────────────────────────
-- FERIO MARKETPLACE — 001: PostGIS geospatial foundation
--
-- Adds a maintained geography point column to PropertyListing and
-- the spatial index required for radius / bounds / nearest search.
--
-- The column is GENERATED from latitude/longitude so every write
-- path (direct listing creation, marketplace projection worker,
-- admin tooling) stays consistent without application changes.
--
-- Idempotent: safe to run multiple times.
-- Requires: PostgreSQL 12+
-- ──────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS postgis;

-- Generated point column synced from latitude/longitude floats.
-- ST_MakePoint / ST_SetSRID are IMMUTABLE, so a stored generated
-- column is valid and always consistent with its source values.
ALTER TABLE "PropertyListing"
  ADD COLUMN IF NOT EXISTS "location" geometry(Point, 4326)
  GENERATED ALWAYS AS (
    CASE
      WHEN "latitude" IS NOT NULL AND "longitude" IS NOT NULL
        THEN ST_SetSRID(ST_MakePoint("longitude", "latitude"), 4326)
    END
  ) STORED;

-- Spatial index powering ST_DWithin / && envelope operators.
CREATE INDEX IF NOT EXISTS "PropertyListing_location_gix"
  ON "PropertyListing" USING GIST ("location");

-- Composite index for the common "geo filter + active + purpose"
-- access pattern so the planner can combine bitmap scans.
CREATE INDEX IF NOT EXISTS "PropertyListing_purpose_status_created_idx"
  ON "PropertyListing" ("purpose", "status", "createdAt" DESC);
