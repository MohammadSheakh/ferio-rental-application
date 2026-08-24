-- ──────────────────────────────────────────────────────────────
-- Tenant schema — 0014: IAM delegation (§ Week 9)
-- ──────────────────────────────────────────────────────────────

CREATE TABLE "MemberDelegation" (
    "id" TEXT NOT NULL,
    "fromMemberId" TEXT NOT NULL,
    "toMemberId" TEXT NOT NULL,
    "domains" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemberDelegation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MemberDelegation_toMemberId_idx" ON "MemberDelegation"("toMemberId");
ALTER TABLE "MemberDelegation" ADD CONSTRAINT "MemberDelegation_fromMemberId_fkey"
  FOREIGN KEY ("fromMemberId") REFERENCES "Member"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MemberDelegation" ADD CONSTRAINT "MemberDelegation_toMemberId_fkey"
  FOREIGN KEY ("toMemberId") REFERENCES "Member"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
