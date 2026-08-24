-- ──────────────────────────────────────────────────────────────
-- Tenant schema — 0016: race guards (§ P0 hardening)
--
-- NOTE: only tenant-plane tables here. ListingPromotion race guard
-- lives in the MARKETPLACE plane (handled via application-level
-- P2002 catch, since the marketplace uses SQL-file migrations).
-- ──────────────────────────────────────────────────────────────

-- Marketplace inquiry dedupe: one lead per unit per contact phone.
CREATE UNIQUE INDEX "CrmLead_inquiry_unit_phone_key"
  ON "CrmLead"("interestedUnitId", phone)
  WHERE source = 'MARKETPLACE_INQUIRY' AND "interestedUnitId" IS NOT NULL AND phone IS NOT NULL;

-- Backfill guard: collapse existing duplicates (keep newest).
DELETE FROM "CrmLead" a USING "CrmLead" b
  WHERE a."createdAt" > b."createdAt"
    AND a.source = 'MARKETPLACE_INQUIRY' AND b.source = 'MARKETPLACE_INQUIRY'
    AND a."interestedUnitId" = b."interestedUnitId"
    AND a.phone IS NOT NULL AND a.phone = b.phone;
