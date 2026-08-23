CREATE TYPE "ShipmentProviderEvidenceSource" AS ENUM ('WEBHOOK', 'POLL');
CREATE TYPE "ShipmentPollAttemptStatus" AS ENUM ('QUEUED', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'SKIPPED');

ALTER TABLE "Shipment"
ADD COLUMN "lastPolledAt" TIMESTAMP(3),
ADD COLUMN "nextPollAt" TIMESTAMP(3),
ADD COLUMN "pollingFailureCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "pollingError" TEXT;

ALTER TABLE "ShipmentWebhookLog"
ADD COLUMN "source" "ShipmentProviderEvidenceSource" NOT NULL DEFAULT 'WEBHOOK';

CREATE TABLE "ShipmentPollAttempt" (
  "id" TEXT NOT NULL,
  "correlationId" TEXT NOT NULL,
  "status" "ShipmentPollAttemptStatus" NOT NULL DEFAULT 'QUEUED',
  "requestedByActorId" TEXT,
  "queueJobId" TEXT,
  "rawResponse" JSONB,
  "normalizedStatus" "OrderShipmentStatus",
  "errorCode" TEXT,
  "errorMessage" TEXT,
  "startedAt" TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3),
  "shipmentId" TEXT NOT NULL,
  "evidenceLogId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ShipmentPollAttempt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ShipmentPollAttempt_correlationId_key" ON "ShipmentPollAttempt"("correlationId");
CREATE UNIQUE INDEX "ShipmentPollAttempt_evidenceLogId_key" ON "ShipmentPollAttempt"("evidenceLogId");
CREATE INDEX "ShipmentPollAttempt_status_createdAt_idx" ON "ShipmentPollAttempt"("status", "createdAt");
CREATE INDEX "ShipmentPollAttempt_shipmentId_createdAt_idx" ON "ShipmentPollAttempt"("shipmentId", "createdAt");
CREATE INDEX "Shipment_nextPollAt_status_idx" ON "Shipment"("nextPollAt", "status");
CREATE INDEX "ShipmentWebhookLog_source_receivedAt_idx" ON "ShipmentWebhookLog"("source", "receivedAt");

ALTER TABLE "ShipmentPollAttempt" ADD CONSTRAINT "ShipmentPollAttempt_shipmentId_fkey"
FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
