ALTER TABLE "CommerceSettings"
ADD COLUMN "serviceBookingEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "warrantyClaimsEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "storefrontAnalyticsEnabled" BOOLEAN NOT NULL DEFAULT true;
