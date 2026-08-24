-- ──────────────────────────────────────────────────────────────
-- Tenant schema — 0015: CRM listing attribution (§ Week 30 tail)
-- ──────────────────────────────────────────────────────────────

ALTER TABLE "CrmLead" ADD COLUMN "listingId" TEXT;
CREATE INDEX "CrmLead_listingId_idx" ON "CrmLead"("listingId");
