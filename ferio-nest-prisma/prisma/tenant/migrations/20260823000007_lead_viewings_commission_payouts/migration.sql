-- ──────────────────────────────────────────────────────────────
-- Tenant schema — 0007: Lead viewings + broker commission payouts
-- (§ Week 30 tail)
-- ──────────────────────────────────────────────────────────────

CREATE TYPE "LeadViewingStatus" AS ENUM ('SCHEDULED', 'COMPLETED', 'NO_SHOW', 'CANCELLED');
CREATE TYPE "CommissionPayoutStatus" AS ENUM ('DUE', 'PAID');

CREATE TABLE "LeadViewing" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "status" "LeadViewingStatus" NOT NULL DEFAULT 'SCHEDULED',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeadViewing_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LeadViewing_leadId_idx" ON "LeadViewing"("leadId");
CREATE INDEX "LeadViewing_scheduledAt_idx" ON "LeadViewing"("scheduledAt");

ALTER TABLE "LeadViewing" ADD CONSTRAINT "LeadViewing_leadId_fkey"
  FOREIGN KEY ("leadId") REFERENCES "CrmLead"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CommissionPayout" (
    "id" TEXT NOT NULL,
    "leaseId" TEXT NOT NULL,
    "brokerName" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "status" "CommissionPayoutStatus" NOT NULL DEFAULT 'DUE',
    "method" "PaymentMethod",
    "reference" TEXT,
    "paidAt" TIMESTAMP(3),
    "recordedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommissionPayout_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CommissionPayout_leaseId_idx" ON "CommissionPayout"("leaseId");
CREATE INDEX "CommissionPayout_status_idx" ON "CommissionPayout"("status");

ALTER TABLE "CommissionPayout" ADD CONSTRAINT "CommissionPayout_leaseId_fkey"
  FOREIGN KEY ("leaseId") REFERENCES "Lease"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
