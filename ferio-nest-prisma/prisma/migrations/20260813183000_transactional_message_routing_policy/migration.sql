ALTER TABLE "CommerceMessage"
ADD COLUMN "channelPlan" "CommerceMessageChannel"[] NOT NULL DEFAULT ARRAY[]::"CommerceMessageChannel"[],
ADD COLUMN "routingPolicyVersion" INTEGER,
ADD COLUMN "fallbackReason" TEXT,
ADD COLUMN "terminalReason" TEXT,
ADD COLUMN "completedAt" TIMESTAMP(3);

CREATE TABLE "CommerceMessagingPolicy" (
  "id" TEXT NOT NULL DEFAULT 'transactional-default',
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "version" INTEGER NOT NULL DEFAULT 1,
  "channelPriority" "CommerceMessageChannel"[] NOT NULL DEFAULT ARRAY[]::"CommerceMessageChannel"[],
  "fallbackOnDefinitiveFailure" BOOLEAN NOT NULL DEFAULT true,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CommerceMessagingPolicy_pkey" PRIMARY KEY ("id")
);

INSERT INTO "CommerceMessagingPolicy" (
  "id", "enabled", "version", "channelPriority", "fallbackOnDefinitiveFailure", "updatedAt"
) VALUES (
  'transactional-default', false, 1, ARRAY[]::"CommerceMessageChannel"[], true, CURRENT_TIMESTAMP
);
