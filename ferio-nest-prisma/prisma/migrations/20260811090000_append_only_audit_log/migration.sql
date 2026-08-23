CREATE TYPE "AuditSource" AS ENUM ('ADMIN_API', 'SYSTEM', 'JOB', 'PROVIDER');

CREATE TABLE "AuditLog" (
  "id" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "actorId" TEXT,
  "actorRole" TEXT,
  "source" "AuditSource" NOT NULL DEFAULT 'ADMIN_API',
  "previousValue" JSONB,
  "newValue" JSONB,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AuditLog_entityType_entityId_createdAt_idx" ON "AuditLog"("entityType", "entityId", "createdAt");
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");
CREATE INDEX "AuditLog_source_createdAt_idx" ON "AuditLog"("source", "createdAt");
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

REVOKE UPDATE, DELETE ON "AuditLog" FROM PUBLIC;
