ALTER TABLE "ShipmentWebhookLog"
ADD COLUMN "attemptCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "processingStartedAt" TIMESTAMP(3),
ADD COLUMN "lastAttemptAt" TIMESTAMP(3);

CREATE INDEX "ShipmentWebhookLog_processingStartedAt_idx"
ON "ShipmentWebhookLog"("processingStartedAt");
