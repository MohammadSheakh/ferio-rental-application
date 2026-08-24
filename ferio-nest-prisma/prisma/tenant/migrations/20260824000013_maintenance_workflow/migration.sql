-- ──────────────────────────────────────────────────────────────
-- Tenant schema — 0013: Maintenance workflow depth (§ Weeks 20–21)
-- estimate → approval → work → renter confirmation → close/reopen
-- ──────────────────────────────────────────────────────────────

ALTER TABLE "MaintenanceRequest" ADD COLUMN "estimateNote" TEXT;
ALTER TABLE "MaintenanceRequest" ADD COLUMN "approvalStatus" TEXT; -- PENDING | APPROVED | REJECTED
ALTER TABLE "MaintenanceRequest" ADD COLUMN "approvedAt" TIMESTAMP(3);
ALTER TABLE "MaintenanceRequest" ADD COLUMN "approvedBy" TEXT;
ALTER TABLE "MaintenanceRequest" ADD COLUMN "renterConfirmedAt" TIMESTAMP(3);
ALTER TABLE "MaintenanceRequest" ADD COLUMN "reopenCount" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "WorkOrder" ADD COLUMN "estimatedCost" DOUBLE PRECISION;
ALTER TABLE "WorkOrder" ADD COLUMN "startedAt" TIMESTAMP(3);
