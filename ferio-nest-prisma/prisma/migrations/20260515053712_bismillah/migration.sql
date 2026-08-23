-- CreateEnum
CREATE TYPE "AttachmentType" AS ENUM ('document', 'image', 'video', 'unknown');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('admin', 'business', 'child');

-- CreateEnum
CREATE TYPE "UserAuthProvider" AS ENUM ('local', 'google', 'apple');

-- CreateEnum
CREATE TYPE "UserApprovalStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "UserAdminStatus" AS ENUM ('active', 'inactive');

-- CreateEnum
CREATE TYPE "DeviceType" AS ENUM ('web', 'ios', 'android', 'desktop');

-- CreateEnum
CREATE TYPE "OAuthProvider" AS ENUM ('google', 'apple');

-- CreateEnum
CREATE TYPE "RoleDataAdminStatus" AS ENUM ('active', 'inactive');

-- CreateEnum
CREATE TYPE "ProviderApprovalStatus" AS ENUM ('accept', 'reject', 'pending', 'requested');

-- CreateEnum
CREATE TYPE "ConversationType" AS ENUM ('direct', 'group');

-- CreateEnum
CREATE TYPE "ParticipantRole" AS ENUM ('admin', 'member');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('task', 'group', 'system', 'reminder', 'mention', 'assignment', 'deadline', 'custom');

-- CreateEnum
CREATE TYPE "NotificationPriority" AS ENUM ('low', 'normal', 'high', 'urgent');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('pending', 'sent', 'delivered', 'read', 'failed');

-- CreateEnum
CREATE TYPE "TaskReminderTrigger" AS ENUM ('scheduled', 'before_due', 'after_creation', 'overdue');

-- CreateEnum
CREATE TYPE "TaskReminderStatus" AS ENUM ('pending', 'sent', 'failed', 'cancelled');

-- CreateEnum
CREATE TYPE "TaskReminderFrequency" AS ENUM ('once', 'daily', 'weekly', 'monthly');

-- CreateEnum
CREATE TYPE "PaymentGateway" AS ENUM ('stripe', 'paypal', 'sslcommerz', 'revenuecat', 'none');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('pending', 'processing', 'completed', 'failed', 'refunded', 'cancelled', 'partially_refunded', 'disputed');

-- CreateEnum
CREATE TYPE "PaymentCurrency" AS ENUM ('usd', 'bdt', 'eur', 'gbp');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('userSubscription', 'purchasedJourney', 'purchasedAdminCapsule');

-- CreateEnum
CREATE TYPE "PaymentEnvironment" AS ENUM ('production', 'sandbox');

-- CreateEnum
CREATE TYPE "PaymentPlatform" AS ENUM ('ios', 'android', 'web');

-- CreateEnum
CREATE TYPE "WebhookProcessingStatus" AS ENUM ('pending', 'processing', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "SettingsType" AS ENUM ('aboutUs', 'contactUs', 'privacyPolicy', 'termsAndConditions', 'introductionVideo');

-- CreateEnum
CREATE TYPE "SubscriptionType" AS ENUM ('individual', 'business_starter', 'business_level1', 'business_level2');

-- CreateEnum
CREATE TYPE "InitialDuration" AS ENUM ('month', 'year');

-- CreateEnum
CREATE TYPE "RenewalFrequency" AS ENUM ('monthly', 'yearly');

-- CreateEnum
CREATE TYPE "PurchaseChannel" AS ENUM ('stripe', 'revenuecat', 'both');

-- CreateEnum
CREATE TYPE "Platform" AS ENUM ('ios', 'android', 'web');

-- CreateEnum
CREATE TYPE "SubscriptionCurrency" AS ENUM ('usd', 'bdt', 'eur', 'gbp');

-- CreateEnum
CREATE TYPE "TWalletStatus" AS ENUM ('active', 'frozen', 'suspended');

-- CreateEnum
CREATE TYPE "TCurrency" AS ENUM ('bdt');

-- CreateEnum
CREATE TYPE "TWalletTransactionStatus" AS ENUM ('pending', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "TTransactionFor" AS ENUM ('UserSubscription', 'Purchase');

-- CreateEnum
CREATE TYPE "TWalletTransactionHistory" AS ENUM ('debit', 'credit', 'withdrawal');

-- CreateEnum
CREATE TYPE "TWithdrawalRequest" AS ENUM ('completed', 'failed', 'processing', 'requested', 'rejected');

-- CreateEnum
CREATE TYPE "TBankAccount" AS ENUM ('savings', 'current');

-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL,
    "attachment" TEXT NOT NULL,
    "attachmentType" "AttachmentType" NOT NULL,
    "publicId" TEXT,
    "originalName" TEXT,
    "size" INTEGER,
    "mimeType" TEXT,
    "uploadedByUserId" TEXT,
    "attachedToType" TEXT,
    "attachedToId" TEXT,
    "withdrawalRequestId" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OAuthAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "authProvider" "OAuthProvider" NOT NULL,
    "providerId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT true,
    "lastUsedAt" TIMESTAMP(3),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OAuthAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT,
    "role" "UserRole" NOT NULL,
    "profileImageUrl" TEXT NOT NULL DEFAULT '/uploads/users/user.png',
    "phoneNumber" TEXT,
    "isEmailVerified" BOOLEAN NOT NULL DEFAULT false,
    "authProvider" "UserAuthProvider" NOT NULL DEFAULT 'local',
    "preferredTime" TEXT NOT NULL DEFAULT '07:00',
    "isResetPassword" BOOLEAN NOT NULL DEFAULT false,
    "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockUntil" TIMESTAMP(3),
    "walletId" TEXT,
    "profileId" TEXT,
    "accountCreatorId" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserDevices" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fcmToken" TEXT NOT NULL,
    "deviceType" "DeviceType" NOT NULL DEFAULT 'web',
    "deviceName" TEXT,
    "deviceOsVersion" TEXT,
    "appVersion" TEXT,
    "lastActive" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pushEnabled" BOOLEAN NOT NULL DEFAULT true,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserDevices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "location" TEXT,
    "dob" TIMESTAMP(3),
    "gender" TEXT,
    "acceptTOC" BOOLEAN NOT NULL DEFAULT false,
    "supportMode" TEXT NOT NULL DEFAULT 'calm',
    "notificationStyle" TEXT NOT NULL DEFAULT 'gentle',
    "providerApprovalStatus" "UserApprovalStatus" NOT NULL DEFAULT 'pending',
    "adminStatus" "UserAdminStatus" NOT NULL DEFAULT 'active',
    "frontSideCertificateImage" TEXT,
    "backSideCertificateImage" TEXT,
    "faceImageFromFrontCam" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRoleData" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "adminStatus" "RoleDataAdminStatus",
    "providerApprovalStatus" "ProviderApprovalStatus",
    "approvedAt" TIMESTAMP(3),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserRoleData_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "type" "ConversationType" NOT NULL,
    "groupName" TEXT,
    "groupProfilePicture" TEXT,
    "lastMessageId" TEXT,
    "lastMessageText" TEXT,
    "lastMessageCreatedAt" TIMESTAMP(3),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationParticipents" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "role" "ParticipantRole" NOT NULL,
    "lastMessageReadAt" TIMESTAMP(3),
    "lastMessageReadId" TEXT,
    "unreadCount" INTEGER NOT NULL DEFAULT 0,
    "isThisConversationUnseen" INTEGER NOT NULL DEFAULT 0,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConversationParticipents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageReadStatus" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MessageReadStatus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "senderId" TEXT,
    "receiverId" TEXT,
    "receiverRole" TEXT,
    "type" "NotificationType" NOT NULL,
    "priority" "NotificationPriority" NOT NULL DEFAULT 'normal',
    "status" "NotificationStatus" NOT NULL DEFAULT 'pending',
    "title" TEXT NOT NULL,
    "message" TEXT,
    "entityType" TEXT,
    "entityId" TEXT,
    "linkFor" TEXT,
    "linkId" TEXT,
    "data" JSONB,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskReminder" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "triggerType" "TaskReminderTrigger" NOT NULL,
    "reminderTime" TIMESTAMP(3) NOT NULL,
    "customMessage" TEXT,
    "status" "TaskReminderStatus" NOT NULL DEFAULT 'pending',
    "frequency" "TaskReminderFrequency" NOT NULL DEFAULT 'once',
    "deliveryChannels" TEXT[],
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "lastSentAt" TIMESTAMP(3),
    "nextReminderTime" TIMESTAMP(3),
    "bullJobId" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskReminder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentTransaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "referenceFor" "TransactionType" NOT NULL,
    "referenceId" TEXT NOT NULL,
    "paymentGateway" "PaymentGateway" NOT NULL,
    "transactionId" TEXT,
    "paymentIntent" TEXT,
    "amount" INTEGER NOT NULL,
    "currency" "PaymentCurrency" NOT NULL,
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'pending',
    "gatewayResponse" JSONB,
    "revenueCatOrderId" TEXT,
    "revenueCatEnvironment" "PaymentEnvironment",
    "platform" "PaymentPlatform",
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RevenueCatWebhookEvent" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "appId" TEXT,
    "userId" TEXT,
    "productId" TEXT,
    "environment" "PaymentEnvironment",
    "eventData" JSONB NOT NULL,
    "processingStatus" "WebhookProcessingStatus" NOT NULL DEFAULT 'pending',
    "errorMessage" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RevenueCatWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StripeAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StripeAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StripeWebhookEvent" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "accountId" TEXT,
    "paymentIntentId" TEXT,
    "customerId" TEXT,
    "amount" INTEGER,
    "currency" TEXT,
    "eventData" JSONB NOT NULL,
    "processingStatus" "WebhookProcessingStatus" NOT NULL DEFAULT 'pending',
    "errorMessage" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StripeWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Settings" (
    "id" TEXT NOT NULL,
    "type" "SettingsType" NOT NULL,
    "details" TEXT NOT NULL DEFAULT '',
    "introductionVideo" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionPlan" (
    "id" TEXT NOT NULL,
    "subscriptionName" TEXT NOT NULL,
    "subscriptionType" "SubscriptionType" NOT NULL,
    "freeTrialEnabled" BOOLEAN NOT NULL DEFAULT true,
    "freeTrialDurationDays" INTEGER,
    "initialDuration" "InitialDuration" NOT NULL DEFAULT 'month',
    "renewalFrequncy" "RenewalFrequency" NOT NULL DEFAULT 'monthly',
    "amount" TEXT NOT NULL,
    "currency" "SubscriptionCurrency" NOT NULL DEFAULT 'usd',
    "maxChildrenAccount" INTEGER NOT NULL,
    "stripe_product_id" TEXT,
    "stripe_price_id" TEXT,
    "purchaseChannel" "PurchaseChannel" NOT NULL DEFAULT 'stripe',
    "revenueCatProductIdentifier" TEXT,
    "revenueCatPackageIdentifier" TEXT,
    "availablePlatforms" "Platform"[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubscriptionPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankInfo" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bankAccountNumber" TEXT NOT NULL,
    "bankRoutingNumber" TEXT NOT NULL,
    "bankAccountHolderName" TEXT NOT NULL,
    "bankAccountType" "TBankAccount" NOT NULL,
    "bankBranch" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL,
    "isDeleted" BOOLEAN NOT NULL,

    CONSTRAINT "BankInfo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Wallet" (
    "id" TEXT NOT NULL,
    "amount" INTEGER,
    "totalBalance" INTEGER,
    "currency" "TCurrency",
    "status" "TWalletStatus" NOT NULL,
    "isDeleted" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletTransactionHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "withdrawalRequestId" TEXT,
    "type" "TWalletTransactionHistory" NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" "TCurrency",
    "balanceBefore" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "status" "TWalletTransactionStatus" NOT NULL,
    "referenceFor" "TTransactionFor" NOT NULL,
    "userSubscriptionId" TEXT,
    "purchaseId" TEXT,
    "isDeleted" BOOLEAN NOT NULL,

    CONSTRAINT "WalletTransactionHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WithdrawalRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "requestedAmount" INTEGER NOT NULL,
    "bankAccountNumber" TEXT NOT NULL,
    "bankRoutingNumber" TEXT NOT NULL,
    "bankAccountHolderName" TEXT NOT NULL,
    "bankAccountType" "TBankAccount" NOT NULL,
    "bankBranch" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "status" "TWithdrawalRequest" NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL,
    "isDeleted" BOOLEAN NOT NULL,

    CONSTRAINT "WithdrawalRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_AttachmentToMessage" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_AttachmentToMessage_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "Attachment_uploadedByUserId_isDeleted_idx" ON "Attachment"("uploadedByUserId", "isDeleted");

-- CreateIndex
CREATE INDEX "Attachment_attachedToType_attachedToId_isDeleted_idx" ON "Attachment"("attachedToType", "attachedToId", "isDeleted");

-- CreateIndex
CREATE INDEX "Attachment_attachmentType_isDeleted_idx" ON "Attachment"("attachmentType", "isDeleted");

-- CreateIndex
CREATE INDEX "Attachment_createdAt_isDeleted_idx" ON "Attachment"("createdAt", "isDeleted");

-- CreateIndex
CREATE INDEX "OAuthAccount_userId_isDeleted_idx" ON "OAuthAccount"("userId", "isDeleted");

-- CreateIndex
CREATE INDEX "OAuthAccount_authProvider_providerId_isDeleted_idx" ON "OAuthAccount"("authProvider", "providerId", "isDeleted");

-- CreateIndex
CREATE INDEX "OAuthAccount_email_isDeleted_idx" ON "OAuthAccount"("email", "isDeleted");

-- CreateIndex
CREATE INDEX "OAuthAccount_providerId_isDeleted_idx" ON "OAuthAccount"("providerId", "isDeleted");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthAccount_authProvider_providerId_key" ON "OAuthAccount"("authProvider", "providerId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_walletId_key" ON "User"("walletId");

-- CreateIndex
CREATE UNIQUE INDEX "User_profileId_key" ON "User"("profileId");

-- CreateIndex
CREATE INDEX "User_email_isDeleted_idx" ON "User"("email", "isDeleted");

-- CreateIndex
CREATE INDEX "User_role_isDeleted_idx" ON "User"("role", "isDeleted");

-- CreateIndex
CREATE INDEX "User_role_isEmailVerified_isDeleted_idx" ON "User"("role", "isEmailVerified", "isDeleted");

-- CreateIndex
CREATE INDEX "User_accountCreatorId_isDeleted_idx" ON "User"("accountCreatorId", "isDeleted");

-- CreateIndex
CREATE INDEX "User_createdAt_isDeleted_idx" ON "User"("createdAt", "isDeleted");

-- CreateIndex
CREATE INDEX "UserDevices_userId_isDeleted_idx" ON "UserDevices"("userId", "isDeleted");

-- CreateIndex
CREATE INDEX "UserDevices_fcmToken_isDeleted_idx" ON "UserDevices"("fcmToken", "isDeleted");

-- CreateIndex
CREATE INDEX "UserDevices_deviceType_isDeleted_idx" ON "UserDevices"("deviceType", "isDeleted");

-- CreateIndex
CREATE INDEX "UserDevices_lastActive_isDeleted_idx" ON "UserDevices"("lastActive", "isDeleted");

-- CreateIndex
CREATE UNIQUE INDEX "UserProfile_userId_key" ON "UserProfile"("userId");

-- CreateIndex
CREATE INDEX "UserProfile_userId_isDeleted_idx" ON "UserProfile"("userId", "isDeleted");

-- CreateIndex
CREATE INDEX "UserProfile_providerApprovalStatus_isDeleted_idx" ON "UserProfile"("providerApprovalStatus", "isDeleted");

-- CreateIndex
CREATE INDEX "UserProfile_adminStatus_isDeleted_idx" ON "UserProfile"("adminStatus", "isDeleted");

-- CreateIndex
CREATE INDEX "UserRoleData_userId_idx" ON "UserRoleData"("userId");

-- CreateIndex
CREATE INDEX "Conversation_creatorId_isDeleted_idx" ON "Conversation"("creatorId", "isDeleted");

-- CreateIndex
CREATE INDEX "Conversation_type_isDeleted_idx" ON "Conversation"("type", "isDeleted");

-- CreateIndex
CREATE INDEX "Conversation_lastMessageCreatedAt_isDeleted_idx" ON "Conversation"("lastMessageCreatedAt", "isDeleted");

-- CreateIndex
CREATE INDEX "ConversationParticipents_userId_conversationId_isDeleted_idx" ON "ConversationParticipents"("userId", "conversationId", "isDeleted");

-- CreateIndex
CREATE INDEX "ConversationParticipents_conversationId_isDeleted_idx" ON "ConversationParticipents"("conversationId", "isDeleted");

-- CreateIndex
CREATE INDEX "ConversationParticipents_userId_isDeleted_idx" ON "ConversationParticipents"("userId", "isDeleted");

-- CreateIndex
CREATE INDEX "Message_conversationId_createdAt_isDeleted_idx" ON "Message"("conversationId", "createdAt", "isDeleted");

-- CreateIndex
CREATE INDEX "Message_senderId_isDeleted_idx" ON "Message"("senderId", "isDeleted");

-- CreateIndex
CREATE INDEX "Message_createdAt_isDeleted_idx" ON "Message"("createdAt", "isDeleted");

-- CreateIndex
CREATE INDEX "MessageReadStatus_messageId_userId_isDeleted_idx" ON "MessageReadStatus"("messageId", "userId", "isDeleted");

-- CreateIndex
CREATE INDEX "MessageReadStatus_conversationId_userId_isRead_idx" ON "MessageReadStatus"("conversationId", "userId", "isRead");

-- CreateIndex
CREATE INDEX "MessageReadStatus_userId_isRead_idx" ON "MessageReadStatus"("userId", "isRead");

-- CreateIndex
CREATE UNIQUE INDEX "MessageReadStatus_messageId_userId_key" ON "MessageReadStatus"("messageId", "userId");

-- CreateIndex
CREATE INDEX "Notification_receiverId_isRead_isDeleted_createdAt_idx" ON "Notification"("receiverId", "isRead", "isDeleted", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_receiverId_status_isDeleted_idx" ON "Notification"("receiverId", "status", "isDeleted");

-- CreateIndex
CREATE INDEX "Notification_senderId_isDeleted_idx" ON "Notification"("senderId", "isDeleted");

-- CreateIndex
CREATE INDEX "Notification_type_isDeleted_idx" ON "Notification"("type", "isDeleted");

-- CreateIndex
CREATE INDEX "Notification_entityType_entityId_isDeleted_idx" ON "Notification"("entityType", "entityId", "isDeleted");

-- CreateIndex
CREATE INDEX "Notification_receiverRole_isDeleted_idx" ON "Notification"("receiverRole", "isDeleted");

-- CreateIndex
CREATE INDEX "TaskReminder_userId_status_isDeleted_idx" ON "TaskReminder"("userId", "status", "isDeleted");

-- CreateIndex
CREATE INDEX "TaskReminder_taskId_isDeleted_idx" ON "TaskReminder"("taskId", "isDeleted");

-- CreateIndex
CREATE INDEX "TaskReminder_reminderTime_status_idx" ON "TaskReminder"("reminderTime", "status");

-- CreateIndex
CREATE INDEX "PaymentTransaction_userId_paymentStatus_isDeleted_idx" ON "PaymentTransaction"("userId", "paymentStatus", "isDeleted");

-- CreateIndex
CREATE INDEX "PaymentTransaction_referenceFor_referenceId_isDeleted_idx" ON "PaymentTransaction"("referenceFor", "referenceId", "isDeleted");

-- CreateIndex
CREATE INDEX "PaymentTransaction_paymentGateway_transactionId_idx" ON "PaymentTransaction"("paymentGateway", "transactionId");

-- CreateIndex
CREATE INDEX "PaymentTransaction_revenueCatOrderId_isDeleted_idx" ON "PaymentTransaction"("revenueCatOrderId", "isDeleted");

-- CreateIndex
CREATE INDEX "PaymentTransaction_createdAt_isDeleted_idx" ON "PaymentTransaction"("createdAt", "isDeleted");

-- CreateIndex
CREATE INDEX "PaymentTransaction_paymentStatus_createdAt_isDeleted_idx" ON "PaymentTransaction"("paymentStatus", "createdAt", "isDeleted");

-- CreateIndex
CREATE UNIQUE INDEX "RevenueCatWebhookEvent_eventId_key" ON "RevenueCatWebhookEvent"("eventId");

-- CreateIndex
CREATE INDEX "RevenueCatWebhookEvent_eventType_createdAt_idx" ON "RevenueCatWebhookEvent"("eventType", "createdAt");

-- CreateIndex
CREATE INDEX "RevenueCatWebhookEvent_userId_createdAt_idx" ON "RevenueCatWebhookEvent"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "RevenueCatWebhookEvent_processingStatus_attempts_idx" ON "RevenueCatWebhookEvent"("processingStatus", "attempts");

-- CreateIndex
CREATE INDEX "StripeAccount_userId_isCompleted_idx" ON "StripeAccount"("userId", "isCompleted");

-- CreateIndex
CREATE INDEX "StripeAccount_accountId_idx" ON "StripeAccount"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "StripeWebhookEvent_eventId_key" ON "StripeWebhookEvent"("eventId");

-- CreateIndex
CREATE INDEX "StripeWebhookEvent_eventType_createdAt_idx" ON "StripeWebhookEvent"("eventType", "createdAt");

-- CreateIndex
CREATE INDEX "StripeWebhookEvent_paymentIntentId_createdAt_idx" ON "StripeWebhookEvent"("paymentIntentId", "createdAt");

-- CreateIndex
CREATE INDEX "StripeWebhookEvent_processingStatus_attempts_idx" ON "StripeWebhookEvent"("processingStatus", "attempts");

-- CreateIndex
CREATE UNIQUE INDEX "Settings_type_key" ON "Settings"("type");

-- CreateIndex
CREATE INDEX "Settings_type_idx" ON "Settings"("type");

-- CreateIndex
CREATE INDEX "SubscriptionPlan_subscriptionType_isActive_isDeleted_idx" ON "SubscriptionPlan"("subscriptionType", "isActive", "isDeleted");

-- CreateIndex
CREATE INDEX "SubscriptionPlan_purchaseChannel_isActive_idx" ON "SubscriptionPlan"("purchaseChannel", "isActive");

-- CreateIndex
CREATE INDEX "SubscriptionPlan_stripe_product_id_isDeleted_idx" ON "SubscriptionPlan"("stripe_product_id", "isDeleted");

-- CreateIndex
CREATE INDEX "SubscriptionPlan_stripe_price_id_isDeleted_idx" ON "SubscriptionPlan"("stripe_price_id", "isDeleted");

-- CreateIndex
CREATE INDEX "SubscriptionPlan_revenueCatProductIdentifier_isDeleted_idx" ON "SubscriptionPlan"("revenueCatProductIdentifier", "isDeleted");

-- CreateIndex
CREATE INDEX "SubscriptionPlan_isActive_isDeleted_createdAt_idx" ON "SubscriptionPlan"("isActive", "isDeleted", "createdAt");

-- CreateIndex
CREATE INDEX "_AttachmentToMessage_B_index" ON "_AttachmentToMessage"("B");

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_withdrawalRequestId_fkey" FOREIGN KEY ("withdrawalRequestId") REFERENCES "WithdrawalRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthAccount" ADD CONSTRAINT "OAuthAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_accountCreatorId_fkey" FOREIGN KEY ("accountCreatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserDevices" ADD CONSTRAINT "UserDevices_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserProfile" ADD CONSTRAINT "UserProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRoleData" ADD CONSTRAINT "UserRoleData_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationParticipents" ADD CONSTRAINT "ConversationParticipents_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationParticipents" ADD CONSTRAINT "ConversationParticipents_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageReadStatus" ADD CONSTRAINT "MessageReadStatus_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageReadStatus" ADD CONSTRAINT "MessageReadStatus_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageReadStatus" ADD CONSTRAINT "MessageReadStatus_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskReminder" ADD CONSTRAINT "TaskReminder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskReminder" ADD CONSTRAINT "TaskReminder_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StripeAccount" ADD CONSTRAINT "StripeAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankInfo" ADD CONSTRAINT "BankInfo_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletTransactionHistory" ADD CONSTRAINT "WalletTransactionHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletTransactionHistory" ADD CONSTRAINT "WalletTransactionHistory_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletTransactionHistory" ADD CONSTRAINT "WalletTransactionHistory_withdrawalRequestId_fkey" FOREIGN KEY ("withdrawalRequestId") REFERENCES "WithdrawalRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WithdrawalRequest" ADD CONSTRAINT "WithdrawalRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WithdrawalRequest" ADD CONSTRAINT "WithdrawalRequest_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AttachmentToMessage" ADD CONSTRAINT "_AttachmentToMessage_A_fkey" FOREIGN KEY ("A") REFERENCES "Attachment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AttachmentToMessage" ADD CONSTRAINT "_AttachmentToMessage_B_fkey" FOREIGN KEY ("B") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;
