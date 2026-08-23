CREATE TYPE "ReturnCaseStatus" AS ENUM ('REQUESTED', 'UNDER_REVIEW', 'APPROVED', 'PARTIALLY_APPROVED', 'REJECTED', 'CANCELLED');
CREATE TYPE "ReturnEligibilityStatus" AS ENUM ('ELIGIBLE', 'INELIGIBLE', 'REVIEW_REQUIRED');
CREATE TYPE "ReturnReason" AS ENUM ('DAMAGED', 'DEFECTIVE', 'WRONG_ITEM', 'NOT_AS_DESCRIBED', 'SIZE_OR_FIT', 'CHANGED_MIND', 'OTHER');
CREATE TYPE "ReturnRequestedResolution" AS ENUM ('REFUND', 'REPLACEMENT', 'EXCHANGE', 'OTHER');
CREATE TYPE "ReturnRequestChannel" AS ENUM ('CUSTOMER', 'SUPPORT', 'ADMIN');
CREATE TYPE "ReturnReviewDecision" AS ENUM ('APPROVE', 'PARTIAL_APPROVE', 'REJECT');

CREATE TABLE "ReturnCase" (
  "id" TEXT NOT NULL,
  "rmaReference" TEXT NOT NULL,
  "status" "ReturnCaseStatus" NOT NULL DEFAULT 'REQUESTED',
  "eligibilityStatus" "ReturnEligibilityStatus" NOT NULL,
  "eligibilityReasons" TEXT[],
  "reason" "ReturnReason" NOT NULL,
  "description" TEXT NOT NULL,
  "requestedResolution" "ReturnRequestedResolution" NOT NULL,
  "requestChannel" "ReturnRequestChannel" NOT NULL,
  "reviewDecision" "ReturnReviewDecision",
  "reviewReason" TEXT,
  "createdByActorId" TEXT NOT NULL,
  "reviewedByActorId" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "orderId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ReturnCase_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReturnItem" (
  "id" TEXT NOT NULL,
  "requestedQuantity" INTEGER NOT NULL,
  "approvedQuantity" INTEGER,
  "returnCaseId" TEXT NOT NULL,
  "orderItemId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ReturnItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReturnEvidence" (
  "id" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "returnCaseId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReturnEvidence_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReturnStatusHistory" (
  "id" TEXT NOT NULL,
  "oldStatus" "ReturnCaseStatus",
  "newStatus" "ReturnCaseStatus" NOT NULL,
  "actorId" TEXT NOT NULL,
  "note" TEXT,
  "returnCaseId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReturnStatusHistory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReturnCase_rmaReference_key" ON "ReturnCase"("rmaReference");
CREATE INDEX "ReturnCase_orderId_createdAt_idx" ON "ReturnCase"("orderId", "createdAt");
CREATE INDEX "ReturnCase_status_createdAt_idx" ON "ReturnCase"("status", "createdAt");
CREATE INDEX "ReturnCase_eligibilityStatus_createdAt_idx" ON "ReturnCase"("eligibilityStatus", "createdAt");
CREATE INDEX "ReturnCase_createdByActorId_createdAt_idx" ON "ReturnCase"("createdByActorId", "createdAt");
CREATE UNIQUE INDEX "ReturnItem_returnCaseId_orderItemId_key" ON "ReturnItem"("returnCaseId", "orderItemId");
CREATE INDEX "ReturnItem_orderItemId_idx" ON "ReturnItem"("orderItemId");
CREATE INDEX "ReturnEvidence_returnCaseId_createdAt_idx" ON "ReturnEvidence"("returnCaseId", "createdAt");
CREATE INDEX "ReturnStatusHistory_returnCaseId_createdAt_idx" ON "ReturnStatusHistory"("returnCaseId", "createdAt");
CREATE INDEX "ReturnStatusHistory_actorId_createdAt_idx" ON "ReturnStatusHistory"("actorId", "createdAt");

ALTER TABLE "ReturnCase" ADD CONSTRAINT "ReturnCase_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReturnItem" ADD CONSTRAINT "ReturnItem_returnCaseId_fkey" FOREIGN KEY ("returnCaseId") REFERENCES "ReturnCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReturnItem" ADD CONSTRAINT "ReturnItem_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReturnEvidence" ADD CONSTRAINT "ReturnEvidence_returnCaseId_fkey" FOREIGN KEY ("returnCaseId") REFERENCES "ReturnCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReturnStatusHistory" ADD CONSTRAINT "ReturnStatusHistory_returnCaseId_fkey" FOREIGN KEY ("returnCaseId") REFERENCES "ReturnCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
