CREATE TYPE "ProductYoutubeReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE "ServiceOfferingStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');
CREATE TYPE "ServiceBookingStatus" AS ENUM ('REQUESTED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'REJECTED');

CREATE TABLE "ProductReviewBanner" (
  "id" TEXT NOT NULL, "imageUrl" TEXT NOT NULL, "altText" TEXT, "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true, "productId" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "ProductReviewBanner_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ProductYoutubeReview" (
  "id" TEXT NOT NULL, "youtubeUrl" TEXT NOT NULL, "youtubeVideoId" TEXT NOT NULL, "title" TEXT, "reviewerName" TEXT,
  "status" "ProductYoutubeReviewStatus" NOT NULL DEFAULT 'PENDING', "isFeatured" BOOLEAN NOT NULL DEFAULT false,
  "rejectionReason" TEXT, "submittedById" TEXT NOT NULL, "moderatedById" TEXT, "moderatedAt" TIMESTAMP(3),
  "productId" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProductYoutubeReview_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ServiceOffering" (
  "id" TEXT NOT NULL, "name" TEXT NOT NULL, "slug" TEXT NOT NULL, "description" TEXT NOT NULL,
  "status" "ServiceOfferingStatus" NOT NULL DEFAULT 'DRAFT', "price" INTEGER NOT NULL, "durationMinutes" INTEGER NOT NULL,
  "leadTimeHours" INTEGER NOT NULL DEFAULT 24, "serviceAreaNote" TEXT, "requirements" TEXT, "imageUrl" TEXT,
  "categoryId" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ServiceOffering_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ServiceBooking" (
  "id" TEXT NOT NULL, "reference" TEXT NOT NULL, "status" "ServiceBookingStatus" NOT NULL DEFAULT 'REQUESTED',
  "customerName" TEXT NOT NULL, "phoneOriginal" TEXT NOT NULL, "phoneNormalized" TEXT NOT NULL, "email" TEXT,
  "preferredAt" TIMESTAMP(3) NOT NULL, "address" TEXT, "customerNote" TEXT, "serviceNameSnapshot" TEXT NOT NULL,
  "priceSnapshot" INTEGER NOT NULL, "durationMinutesSnapshot" INTEGER NOT NULL, "adminNote" TEXT, "handledById" TEXT,
  "confirmedAt" TIMESTAMP(3), "completedAt" TIMESTAMP(3), "cancelledAt" TIMESTAMP(3), "serviceId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ServiceBooking_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ServiceBookingHistory" (
  "id" TEXT NOT NULL, "oldStatus" "ServiceBookingStatus", "newStatus" "ServiceBookingStatus" NOT NULL,
  "actorId" TEXT, "source" "OrderHistorySource" NOT NULL, "note" TEXT, "bookingId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "ServiceBookingHistory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProductYoutubeReview_productId_youtubeVideoId_key" ON "ProductYoutubeReview"("productId", "youtubeVideoId");
CREATE INDEX "ProductYoutubeReview_productId_status_isFeatured_createdAt_idx" ON "ProductYoutubeReview"("productId", "status", "isFeatured", "createdAt");
CREATE INDEX "ProductYoutubeReview_submittedById_createdAt_idx" ON "ProductYoutubeReview"("submittedById", "createdAt");
CREATE INDEX "ProductReviewBanner_productId_isActive_sortOrder_idx" ON "ProductReviewBanner"("productId", "isActive", "sortOrder");
CREATE UNIQUE INDEX "ServiceOffering_slug_key" ON "ServiceOffering"("slug");
CREATE INDEX "ServiceOffering_categoryId_status_createdAt_idx" ON "ServiceOffering"("categoryId", "status", "createdAt");
CREATE UNIQUE INDEX "ServiceBooking_reference_key" ON "ServiceBooking"("reference");
CREATE INDEX "ServiceBooking_status_preferredAt_idx" ON "ServiceBooking"("status", "preferredAt");
CREATE INDEX "ServiceBooking_phoneNormalized_createdAt_idx" ON "ServiceBooking"("phoneNormalized", "createdAt");
CREATE INDEX "ServiceBooking_serviceId_createdAt_idx" ON "ServiceBooking"("serviceId", "createdAt");
CREATE INDEX "ServiceBookingHistory_bookingId_createdAt_idx" ON "ServiceBookingHistory"("bookingId", "createdAt");

ALTER TABLE "ProductReviewBanner" ADD CONSTRAINT "ProductReviewBanner_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductYoutubeReview" ADD CONSTRAINT "ProductYoutubeReview_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductYoutubeReview" ADD CONSTRAINT "ProductYoutubeReview_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductYoutubeReview" ADD CONSTRAINT "ProductYoutubeReview_moderatedById_fkey" FOREIGN KEY ("moderatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ServiceOffering" ADD CONSTRAINT "ServiceOffering_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ServiceBooking" ADD CONSTRAINT "ServiceBooking_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "ServiceOffering"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ServiceBookingHistory" ADD CONSTRAINT "ServiceBookingHistory_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "ServiceBooking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
