CREATE TYPE "CommerceRefundStatus" AS ENUM ('PENDING', 'PROCESSING', 'REQUIRES_ACTION', 'SUCCEEDED', 'FAILED', 'CANCELLED');
CREATE TYPE "CommerceRefundMethod" AS ENUM ('ORIGINAL_PAYMENT', 'BANK_TRANSFER', 'BKASH', 'NAGAD', 'ROCKET', 'CASH', 'OTHER');
CREATE TYPE "RefundExecutionMode" AS ENUM ('MANUAL', 'PROVIDER');
CREATE TYPE "RefundAttemptOutcome" AS ENUM ('SUCCEEDED', 'FAILED');

CREATE TABLE "CommerceRefund" (
  "id" TEXT NOT NULL,
  "reference" TEXT NOT NULL,
  "idempotencyKeyHash" TEXT NOT NULL,
  "status" "CommerceRefundStatus" NOT NULL DEFAULT 'PENDING',
  "method" "CommerceRefundMethod" NOT NULL,
  "amount" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'BDT',
  "reason" TEXT NOT NULL,
  "sourcePaymentReference" TEXT,
  "provider" TEXT,
  "providerRefundId" TEXT,
  "providerResult" JSONB,
  "failureReason" TEXT,
  "createdByActorId" TEXT NOT NULL,
  "completedByActorId" TEXT,
  "processedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "orderId" TEXT NOT NULL,
  "returnCaseId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CommerceRefund_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RefundAttempt" (
  "id" TEXT NOT NULL,
  "attemptNumber" INTEGER NOT NULL,
  "deduplicationHash" TEXT NOT NULL,
  "executionMode" "RefundExecutionMode" NOT NULL,
  "outcome" "RefundAttemptOutcome" NOT NULL,
  "provider" TEXT,
  "externalReference" TEXT,
  "result" JSONB,
  "failureReason" TEXT,
  "actorId" TEXT NOT NULL,
  "refundId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RefundAttempt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CommerceRefund_reference_key" ON "CommerceRefund"("reference");
CREATE UNIQUE INDEX "CommerceRefund_idempotencyKeyHash_key" ON "CommerceRefund"("idempotencyKeyHash");
CREATE INDEX "CommerceRefund_orderId_status_createdAt_idx" ON "CommerceRefund"("orderId", "status", "createdAt");
CREATE INDEX "CommerceRefund_returnCaseId_status_createdAt_idx" ON "CommerceRefund"("returnCaseId", "status", "createdAt");
CREATE INDEX "CommerceRefund_status_createdAt_idx" ON "CommerceRefund"("status", "createdAt");
CREATE INDEX "CommerceRefund_createdByActorId_createdAt_idx" ON "CommerceRefund"("createdByActorId", "createdAt");
CREATE UNIQUE INDEX "RefundAttempt_deduplicationHash_key" ON "RefundAttempt"("deduplicationHash");
CREATE UNIQUE INDEX "RefundAttempt_refundId_attemptNumber_key" ON "RefundAttempt"("refundId", "attemptNumber");
CREATE INDEX "RefundAttempt_refundId_createdAt_idx" ON "RefundAttempt"("refundId", "createdAt");
CREATE INDEX "RefundAttempt_outcome_createdAt_idx" ON "RefundAttempt"("outcome", "createdAt");
CREATE INDEX "RefundAttempt_actorId_createdAt_idx" ON "RefundAttempt"("actorId", "createdAt");

ALTER TABLE "CommerceRefund" ADD CONSTRAINT "CommerceRefund_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommerceRefund" ADD CONSTRAINT "CommerceRefund_returnCaseId_fkey" FOREIGN KEY ("returnCaseId") REFERENCES "ReturnCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RefundAttempt" ADD CONSTRAINT "RefundAttempt_refundId_fkey" FOREIGN KEY ("refundId") REFERENCES "CommerceRefund"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
