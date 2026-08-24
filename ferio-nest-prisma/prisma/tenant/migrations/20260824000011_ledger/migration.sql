-- ──────────────────────────────────────────────────────────────
-- Tenant schema — 0011: Double-entry ledger (§ Week 15 readiness)
-- ──────────────────────────────────────────────────────────────

CREATE TABLE "LedgerEntry" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "entryDate" TIMESTAMP(3) NOT NULL,
    "account" TEXT NOT NULL,
    "debit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "credit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "refType" TEXT,
    "refId" TEXT,
    "memo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LedgerEntry_groupId_idx" ON "LedgerEntry"("groupId");
CREATE INDEX "LedgerEntry_account_idx" ON "LedgerEntry"("account");
CREATE INDEX "LedgerEntry_refType_refId_idx" ON "LedgerEntry"("refType", "refId");
CREATE INDEX "LedgerEntry_entryDate_idx" ON "LedgerEntry"("entryDate");
