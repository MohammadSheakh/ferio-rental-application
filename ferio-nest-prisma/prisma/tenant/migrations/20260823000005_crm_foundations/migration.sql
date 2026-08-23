-- ──────────────────────────────────────────────────────────────
-- Tenant schema — 0005: Broker CRM foundations (§ Week 30)
-- ──────────────────────────────────────────────────────────────

CREATE TYPE "CrmLeadSource" AS ENUM ('MARKETPLACE_INQUIRY', 'WALK_IN', 'REFERRAL', 'PHONE', 'OTHER');
CREATE TYPE "CrmLeadStatus" AS ENUM ('NEW', 'CONTACTED', 'VIEWING_SCHEDULED', 'NEGOTIATING', 'CONVERTED', 'LOST');

CREATE TABLE "CrmLead" (
    "id" TEXT NOT NULL,
    "source" "CrmLeadSource" NOT NULL DEFAULT 'OTHER',
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "interestedUnitId" TEXT,
    "assignedTo" TEXT,
    "brokerName" TEXT,
    "status" "CrmLeadStatus" NOT NULL DEFAULT 'NEW',
    "convertedRenterId" TEXT,
    "lostReason" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmLead_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CrmLead_status_idx" ON "CrmLead"("status");
CREATE INDEX "CrmLead_assignedTo_idx" ON "CrmLead"("assignedTo");

ALTER TABLE "Lease" ADD COLUMN "brokerName" TEXT;
ALTER TABLE "Lease" ADD COLUMN "brokerCommissionPct" DOUBLE PRECISION;
ALTER TABLE "Lease" ADD COLUMN "brokerCommissionAmount" DOUBLE PRECISION;
