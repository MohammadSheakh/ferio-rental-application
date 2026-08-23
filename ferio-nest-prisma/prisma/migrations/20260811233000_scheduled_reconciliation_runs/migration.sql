CREATE TYPE "ReconciliationRunTrigger" AS ENUM ('MANUAL', 'SCHEDULED', 'RETRY');

ALTER TABLE "ReconciliationRun"
    ADD COLUMN "trigger" "ReconciliationRunTrigger" NOT NULL DEFAULT 'MANUAL',
    ADD COLUMN "queueJobId" TEXT,
    ADD COLUMN "attemptCount" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "lastAttemptAt" TIMESTAMP(3),
    ALTER COLUMN "initiatedByActorId" DROP NOT NULL;

CREATE INDEX "ReconciliationRun_trigger_startedAt_idx" ON "ReconciliationRun"("trigger", "startedAt");
