ALTER TABLE "CommerceMessage"
ADD COLUMN "templateVersion" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "renderedSubject" TEXT,
ADD COLUMN "renderedBody" TEXT NOT NULL DEFAULT '';

CREATE TABLE "CommerceMessageTemplate" (
  "key" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "subjectTemplate" TEXT,
  "bodyTemplate" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CommerceMessageTemplate_pkey" PRIMARY KEY ("key")
);

CREATE UNIQUE INDEX "CommerceMessageTemplate_eventType_key" ON "CommerceMessageTemplate"("eventType");
CREATE INDEX "CommerceMessageTemplate_enabled_eventType_idx" ON "CommerceMessageTemplate"("enabled", "eventType");
