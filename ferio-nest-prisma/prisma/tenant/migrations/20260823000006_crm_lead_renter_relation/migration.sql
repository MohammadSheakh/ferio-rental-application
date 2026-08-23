-- ──────────────────────────────────────────────────────────────
-- Tenant schema — 0006: CrmLead ↔ Renter relation
-- ──────────────────────────────────────────────────────────────

ALTER TABLE "CrmLead" ADD COLUMN "convertedRenterId" TEXT;

CREATE INDEX "CrmLead_convertedRenterId_idx" ON "CrmLead"("convertedRenterId");

ALTER TABLE "CrmLead" ADD CONSTRAINT "CrmLead_convertedRenterId_fkey"
  FOREIGN KEY ("convertedRenterId") REFERENCES "Renter"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
