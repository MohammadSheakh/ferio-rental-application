-- ──────────────────────────────────────────────────────────────
-- Tenant schema — 0008: Automation engine (§ Week 32)
-- ──────────────────────────────────────────────────────────────

CREATE TYPE "AutomationTrigger" AS ENUM ('INVOICE_OVERDUE', 'LEASE_EXPIRING', 'MAINTENANCE_OPENED', 'LISTING_EXPIRING', 'SUBSCRIPTION_PAST_DUE');
CREATE TYPE "AutomationAction" AS ENUM ('CREATE_NOTICE', 'INVOKE_WEBHOOK');
CREATE TYPE "AutomationExecStatus" AS ENUM ('SUCCESS', 'FAILED', 'SKIPPED_DRYRUN', 'SKIPPED_DUPLICATE', 'SKIPPED_UNSUPPORTED');

CREATE TABLE "AutomationRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "trigger" "AutomationTrigger" NOT NULL,
    "action" "AutomationAction" NOT NULL,
    "config" JSONB,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutomationRule_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AutomationRule_trigger_enabled_idx" ON "AutomationRule"("trigger", "enabled");

CREATE TABLE "AutomationExecution" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "trigger" "AutomationTrigger" NOT NULL,
    "refId" TEXT NOT NULL,
    "status" "AutomationExecStatus" NOT NULL,
    "detail" JSONB,
    "error" TEXT,
    "dryRun" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutomationExecution_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AutomationExecution_ruleId_refId_key" ON "AutomationExecution"("ruleId", "refId");
CREATE INDEX "AutomationExecution_createdAt_idx" ON "AutomationExecution"("createdAt");

ALTER TABLE "AutomationExecution" ADD CONSTRAINT "AutomationExecution_ruleId_fkey"
  FOREIGN KEY ("ruleId") REFERENCES "AutomationRule"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
