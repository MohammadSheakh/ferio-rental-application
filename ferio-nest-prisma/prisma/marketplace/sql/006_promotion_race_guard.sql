-- ──────────────────────────────────────────────────────────────
-- FERIO MARKETPLACE — 006: promotion race guard (§ P0 hardening)
-- One live (PENDING_PAYMENT or ACTIVE) promotion per type per listing.
-- ──────────────────────────────────────────────────────────────

DELETE FROM "ListingPromotion" a USING "ListingPromotion" b
  WHERE a.id > b.id
    AND a."listingId" = b."listingId" AND a.type = b.type
    AND a.status IN ('PENDING_PAYMENT','ACTIVE') AND b.status IN ('PENDING_PAYMENT','ACTIVE');

CREATE UNIQUE INDEX "ListingPromotion_live_type_key"
  ON "ListingPromotion"("listingId", type)
  WHERE status IN ('PENDING_PAYMENT', 'ACTIVE');
