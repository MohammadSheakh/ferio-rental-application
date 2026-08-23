CREATE TYPE "CommerceMessagePurpose" AS ENUM ('TRANSACTIONAL', 'PROMOTIONAL');
CREATE TYPE "CommerceMessageChannel" AS ENUM ('SMS', 'WHATSAPP', 'EMAIL');
CREATE TYPE "CommerceMessageStatus" AS ENUM ('QUEUED', 'PROCESSING', 'SENT', 'DELIVERED', 'FAILED', 'CANCELLED', 'BLOCKED');
CREATE TYPE "CommerceMessageAttemptStatus" AS ENUM ('STARTED', 'ACCEPTED', 'DELIVERED', 'FAILED', 'UNKNOWN');

CREATE TABLE "CommerceMessage" (
  "id" TEXT NOT NULL,
  "deduplicationKey" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "purpose" "CommerceMessagePurpose" NOT NULL DEFAULT 'TRANSACTIONAL',
  "templateKey" TEXT NOT NULL,
  "recipient" TEXT NOT NULL,
  "selectedChannel" "CommerceMessageChannel",
  "status" "CommerceMessageStatus" NOT NULL DEFAULT 'QUEUED',
  "referenceType" TEXT NOT NULL,
  "referenceId" TEXT NOT NULL,
  "payload" JSONB,
  "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lockedAt" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3),
  "deliveredAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CommerceMessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommerceMessageAttempt" (
  "id" TEXT NOT NULL,
  "attemptNumber" INTEGER NOT NULL,
  "channel" "CommerceMessageChannel" NOT NULL,
  "provider" TEXT NOT NULL,
  "status" "CommerceMessageAttemptStatus" NOT NULL DEFAULT 'STARTED',
  "providerMessageId" TEXT,
  "requestPayload" JSONB,
  "responsePayload" JSONB,
  "errorCode" TEXT,
  "errorMessage" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "messageId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommerceMessageAttempt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CommerceMessage_deduplicationKey_key" ON "CommerceMessage"("deduplicationKey");
CREATE INDEX "CommerceMessage_status_availableAt_idx" ON "CommerceMessage"("status", "availableAt");
CREATE INDEX "CommerceMessage_referenceType_referenceId_createdAt_idx" ON "CommerceMessage"("referenceType", "referenceId", "createdAt");
CREATE INDEX "CommerceMessage_recipient_createdAt_idx" ON "CommerceMessage"("recipient", "createdAt");
CREATE INDEX "CommerceMessage_eventType_createdAt_idx" ON "CommerceMessage"("eventType", "createdAt");
CREATE UNIQUE INDEX "CommerceMessageAttempt_messageId_attemptNumber_key" ON "CommerceMessageAttempt"("messageId", "attemptNumber");
CREATE INDEX "CommerceMessageAttempt_status_createdAt_idx" ON "CommerceMessageAttempt"("status", "createdAt");
CREATE INDEX "CommerceMessageAttempt_provider_providerMessageId_idx" ON "CommerceMessageAttempt"("provider", "providerMessageId");

ALTER TABLE "CommerceMessageAttempt" ADD CONSTRAINT "CommerceMessageAttempt_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "CommerceMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
