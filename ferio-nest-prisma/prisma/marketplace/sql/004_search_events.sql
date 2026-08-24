-- ──────────────────────────────────────────────────────────────
-- FERIO MARKETPLACE — 004: search activity tracking (§ Weeks 34–35)
-- ──────────────────────────────────────────────────────────────

CREATE TABLE "SearchEvent" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'SEARCH', -- SEARCH | MAP
    "purpose" TEXT,
    "assetType" TEXT,
    "area" TEXT,
    "resultCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SearchEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SearchEvent_createdAt_idx" ON "SearchEvent"("createdAt");
CREATE INDEX "SearchEvent_area_idx" ON "SearchEvent"("area");
