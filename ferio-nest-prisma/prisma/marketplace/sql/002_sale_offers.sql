-- ──────────────────────────────────────────────────────────────
-- FERIO MARKETPLACE — 002: Sale offers (§ Week 31 Sale CRM)
-- ──────────────────────────────────────────────────────────────

CREATE TYPE "SaleOfferStatus" AS ENUM ('PENDING', 'COUNTERED', 'ACCEPTED', 'REJECTED', 'WITHDRAWN');

CREATE TABLE "SaleOffer" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "status" "SaleOfferStatus" NOT NULL DEFAULT 'PENDING',
    "counterAmount" DOUBLE PRECISION,
    "note" TEXT,
    "brokerAccountId" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SaleOffer_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SaleOffer_listingId_idx" ON "SaleOffer"("listingId");
CREATE INDEX "SaleOffer_buyerId_idx" ON "SaleOffer"("buyerId");
CREATE INDEX "SaleOffer_status_idx" ON "SaleOffer"("status");

ALTER TABLE "SaleOffer" ADD CONSTRAINT "SaleOffer_listingId_fkey"
  FOREIGN KEY ("listingId") REFERENCES "PropertyListing"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SaleOffer" ADD CONSTRAINT "SaleOffer_buyerId_fkey"
  FOREIGN KEY ("buyerId") REFERENCES "MarketplaceAccount"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
