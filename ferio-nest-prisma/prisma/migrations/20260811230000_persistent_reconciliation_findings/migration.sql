CREATE TYPE "ReconciliationDomain" AS ENUM ('INVENTORY', 'PAYMENT', 'SHIPPING', 'REFUND', 'SETTLEMENT');
CREATE TYPE "ReconciliationSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE "ReconciliationFindingStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED');
CREATE TYPE "ReconciliationFindingType" AS ENUM ('DELIVERED_COD_MISSING_COLLECTION', 'OVERDUE_COD_COLLECTION', 'RTO_WITH_COLLECTION', 'COD_COLLECTION_VARIANCE', 'COURIER_SETTLEMENT_VARIANCE', 'COD_PAYMENT_STATE_MISMATCH', 'TERMINAL_ORDER_ACTIVE_RESERVATION', 'INVALID_STOCK_BALANCE', 'AGED_PENDING_REFUND');
CREATE TYPE "ReconciliationRunStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED');

CREATE TABLE "ReconciliationFinding" (
    "id" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "type" "ReconciliationFindingType" NOT NULL,
    "domain" "ReconciliationDomain" NOT NULL,
    "severity" "ReconciliationSeverity" NOT NULL,
    "status" "ReconciliationFindingStatus" NOT NULL DEFAULT 'OPEN',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "context" JSONB NOT NULL,
    "occurrenceCount" INTEGER NOT NULL DEFAULT 1,
    "firstDetectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ownerActorId" TEXT,
    "acknowledgedByActorId" TEXT,
    "acknowledgedAt" TIMESTAMP(3),
    "acknowledgementNote" TEXT,
    "resolvedByActorId" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolutionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ReconciliationFinding_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReconciliationRun" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "idempotencyKeyHash" TEXT NOT NULL,
    "status" "ReconciliationRunStatus" NOT NULL DEFAULT 'RUNNING',
    "overdueHours" INTEGER NOT NULL,
    "detectedCount" INTEGER NOT NULL DEFAULT 0,
    "openedCount" INTEGER NOT NULL DEFAULT 0,
    "autoResolvedCount" INTEGER NOT NULL DEFAULT 0,
    "initiatedByActorId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReconciliationRun_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReconciliationFinding_fingerprint_key" ON "ReconciliationFinding"("fingerprint");
CREATE INDEX "ReconciliationFinding_status_severity_lastSeenAt_idx" ON "ReconciliationFinding"("status", "severity", "lastSeenAt");
CREATE INDEX "ReconciliationFinding_domain_status_lastSeenAt_idx" ON "ReconciliationFinding"("domain", "status", "lastSeenAt");
CREATE INDEX "ReconciliationFinding_type_status_idx" ON "ReconciliationFinding"("type", "status");
CREATE INDEX "ReconciliationFinding_ownerActorId_status_idx" ON "ReconciliationFinding"("ownerActorId", "status");
CREATE INDEX "ReconciliationFinding_entityType_entityId_idx" ON "ReconciliationFinding"("entityType", "entityId");
CREATE UNIQUE INDEX "ReconciliationRun_reference_key" ON "ReconciliationRun"("reference");
CREATE UNIQUE INDEX "ReconciliationRun_idempotencyKeyHash_key" ON "ReconciliationRun"("idempotencyKeyHash");
CREATE INDEX "ReconciliationRun_status_startedAt_idx" ON "ReconciliationRun"("status", "startedAt");
CREATE INDEX "ReconciliationRun_initiatedByActorId_startedAt_idx" ON "ReconciliationRun"("initiatedByActorId", "startedAt");
