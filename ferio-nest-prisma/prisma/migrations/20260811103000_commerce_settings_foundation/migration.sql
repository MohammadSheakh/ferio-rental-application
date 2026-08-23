CREATE TABLE "CommerceSettings" (
  "id" TEXT NOT NULL DEFAULT 'default',
  "storeName" TEXT NOT NULL DEFAULT 'Ferio',
  "legalName" TEXT,
  "supportPhone" TEXT,
  "supportEmail" TEXT,
  "currency" TEXT NOT NULL DEFAULT 'BDT',
  "timezone" TEXT NOT NULL DEFAULT 'Asia/Dhaka',
  "orderPrefix" TEXT NOT NULL DEFAULT 'FER',
  "defaultReturnWindowDays" INTEGER,
  "codEnabled" BOOLEAN NOT NULL DEFAULT true,
  "prepaidEnabled" BOOLEAN NOT NULL DEFAULT false,
  "termsUrl" TEXT,
  "privacyUrl" TEXT,
  "returnPolicyUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommerceSettings_pkey" PRIMARY KEY ("id")
);

INSERT INTO "CommerceSettings" ("id") VALUES ('default');
