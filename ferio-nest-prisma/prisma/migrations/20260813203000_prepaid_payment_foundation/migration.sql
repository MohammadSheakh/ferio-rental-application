ALTER TYPE "CheckoutPaymentMethod" ADD VALUE 'PREPAID';
CREATE TYPE "CommercePaymentProvider" AS ENUM ('SSLCOMMERZ', 'AAMARPAY');
CREATE TYPE "CommercePaymentAttemptStatus" AS ENUM ('CREATED', 'INITIATING', 'PENDING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'EXPIRED', 'UNKNOWN');
CREATE TYPE "CommercePaymentCallbackStatus" AS ENUM ('RECEIVED', 'VALIDATED', 'REJECTED', 'DUPLICATE', 'FAILED');

ALTER TABLE "CheckoutDraft" ADD COLUMN "paymentProvider" "CommercePaymentProvider";

CREATE TABLE "CommercePaymentAttempt" (
  "id" TEXT NOT NULL,
  "merchantTransactionId" TEXT NOT NULL,
  "provider" "CommercePaymentProvider" NOT NULL,
  "status" "CommercePaymentAttemptStatus" NOT NULL DEFAULT 'CREATED',
  "amount" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'BDT',
  "providerSessionId" TEXT,
  "providerTransactionId" TEXT,
  "providerValidationId" TEXT,
  "redirectUrl" TEXT,
  "initiationRequest" JSONB,
  "initiationResponse" JSONB,
  "validatedResponse" JSONB,
  "failureCode" TEXT,
  "failureMessage" TEXT,
  "expiresAt" TIMESTAMP(3),
  "initiatedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "orderId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CommercePaymentAttempt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommercePaymentCallback" (
  "id" TEXT NOT NULL,
  "deduplicationKey" TEXT NOT NULL,
  "provider" "CommercePaymentProvider" NOT NULL,
  "status" "CommercePaymentCallbackStatus" NOT NULL DEFAULT 'RECEIVED',
  "eventType" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "errorMessage" TEXT,
  "processedAt" TIMESTAMP(3),
  "attemptId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommercePaymentCallback_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CommercePaymentAttempt_merchantTransactionId_key" ON "CommercePaymentAttempt"("merchantTransactionId");
CREATE INDEX "CommercePaymentAttempt_orderId_createdAt_idx" ON "CommercePaymentAttempt"("orderId", "createdAt");
CREATE INDEX "CommercePaymentAttempt_provider_status_createdAt_idx" ON "CommercePaymentAttempt"("provider", "status", "createdAt");
CREATE INDEX "CommercePaymentAttempt_providerTransactionId_idx" ON "CommercePaymentAttempt"("providerTransactionId");
CREATE UNIQUE INDEX "CommercePaymentCallback_deduplicationKey_key" ON "CommercePaymentCallback"("deduplicationKey");
CREATE INDEX "CommercePaymentCallback_provider_createdAt_idx" ON "CommercePaymentCallback"("provider", "createdAt");
CREATE INDEX "CommercePaymentCallback_attemptId_createdAt_idx" ON "CommercePaymentCallback"("attemptId", "createdAt");
CREATE INDEX "CommercePaymentCallback_status_createdAt_idx" ON "CommercePaymentCallback"("status", "createdAt");
ALTER TABLE "CommercePaymentAttempt" ADD CONSTRAINT "CommercePaymentAttempt_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommercePaymentCallback" ADD CONSTRAINT "CommercePaymentCallback_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "CommercePaymentAttempt"("id") ON DELETE SET NULL ON UPDATE CASCADE;
