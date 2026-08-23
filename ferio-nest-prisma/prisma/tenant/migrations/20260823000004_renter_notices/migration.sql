-- ──────────────────────────────────────────────────────────────
-- Tenant schema — 0004: Notices (§ Week 28 Renter Portal)
-- ──────────────────────────────────────────────────────────────

CREATE TABLE "Notice" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "unitId" TEXT,
    "postedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notice_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Notice_unitId_idx" ON "Notice"("unitId");
