-- ──────────────────────────────────────────────────────────────
-- Tenant schema — 0006: CrmLead ↔ Renter relation
--
-- NOTE: written defensively (IF NOT EXISTS / guarded) because
-- 0005 already creates CrmLead.convertedRenterId — a plain
-- ADD COLUMN here breaks fresh-database replay (prog-27).
-- ──────────────────────────────────────────────────────────────

ALTER TABLE "CrmLead" ADD COLUMN IF NOT EXISTS "convertedRenterId" TEXT;

CREATE INDEX IF NOT EXISTS "CrmLead_convertedRenterId_idx" ON "CrmLead"("convertedRenterId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CrmLead_convertedRenterId_fkey'
  ) THEN
    ALTER TABLE "CrmLead" ADD CONSTRAINT "CrmLead_convertedRenterId_fkey"
      FOREIGN KEY ("convertedRenterId") REFERENCES "Renter"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
