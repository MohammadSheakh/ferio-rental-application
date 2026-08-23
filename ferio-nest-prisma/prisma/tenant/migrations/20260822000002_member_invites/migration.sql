-- ──────────────────────────────────────────────────────────────
-- Tenant schema — 0002: MemberInvite (§9 SaaS IAM)
-- Single-use expiring membership invitations.
-- ──────────────────────────────────────────────────────────────

-- CreateTable
CREATE TABLE "MemberInvite" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "MemberRole" NOT NULL,
    "token" TEXT NOT NULL,
    "invitedBy" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemberInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MemberInvite_token_key" ON "MemberInvite"("token");

-- CreateIndex
CREATE UNIQUE INDEX "MemberInvite_email_key" ON "MemberInvite"("email");
