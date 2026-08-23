import { Injectable, Inject, NotFoundException, ConflictException } from '@nestjs/common';
import { OAuthAccount, OAuthProvider, Prisma } from '@prisma/client';

import { GenericService } from '@app/common';
import { PrismaService } from '@app/database';


const publicOAuthAccountSelect = {
  id: true,
  
  isDeleted: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.OAuthAccountSelect;

type OAuthAccountRecord = Prisma.OAuthAccountGetPayload<{
  select: typeof publicOAuthAccountSelect;
}>;

/**
 * OAuthAccount Service
 * 
 * Manages OAuth provider accounts linked to users
 * Extends GenericService for CRUD operations
 */
@Injectable()
export class OAuthAccountService extends GenericService<Prisma.OAuthAccountDelegate, OAuthAccountRecord> {
  constructor(
    private readonly prisma: PrismaService,
  ) {
    super(prisma.oauthAccount, publicOAuthAccountSelect);
  }

  /**
   * Find OAuth account by provider and provider ID
   */
  async findByProvider(
    authProvider: OAuthProvider,
    providerId: string,
  ): Promise<OAuthAccount | null> {
    return this.prisma.oauthAccount.findFirst({
      where: { authProvider, providerId, isDeleted: false },
    });
  }

  /**
   * Find OAuth account by user ID
   */
  async findByUserId(userId: string): Promise<OAuthAccount[]> {
    return this.prisma.oauthAccount.findMany({
      where: { userId, isDeleted: false },
    });
  }

  /**
   * Create or link OAuth account
   */
  async createOrLinkOAuthAccount(
    userId: string,
    authProvider: OAuthProvider,
    providerId: string,
    email: string,
    accessToken?: string,
    refreshToken?: string,
    idToken?: string,
  ): Promise<OAuthAccount> {
    // Check if OAuth account already exists
    const existing = await this.findByProvider(authProvider, providerId);

    if (existing) {
      throw new ConflictException('OAuth account already exists');
    }

    // Create new OAuth account
    return this.prisma.oauthAccount.create({
      data: {
        userId,
        authProvider,
        providerId,
        email: email.toLowerCase(),
        accessToken,
        refreshToken,
        idToken,
        isVerified: true,
        lastUsedAt: new Date(),
      },
    });
  }

  /**
   * Link OAuth account to existing user
   */
  async linkOAuthAccount(
    userId: string,
    authProvider: OAuthProvider,
    providerId: string,
    email: string,
    accessToken?: string,
  ): Promise<OAuthAccount> {
    // Check if user already has this OAuth provider
    const existing = await this.prisma.oauthAccount.findFirst({
      where: { userId, authProvider, isDeleted: false },
    });

    if (existing) {
      throw new ConflictException('User already has this OAuth provider linked');
    }

    // Create OAuth account
    return this.prisma.oauthAccount.create({
      data: {
        userId,
        authProvider,
        providerId,
        email: email.toLowerCase(),
        accessToken,
        isVerified: true,
        lastUsedAt: new Date(),
      },
    });
  }

  /**
   * Update OAuth account last used timestamp
   */
  async updateLastUsed(oauthAccountId: string): Promise<OAuthAccount | null> {
    return this.prisma.oauthAccount.update({
      where: { id: oauthAccountId },
      data: { lastUsedAt: new Date() },
    });
  }

  /**
   * Unlink OAuth account from user
   */
  async unlinkOAuthAccount(userId: string, authProvider: OAuthProvider): Promise<void> {
    const result = await this.prisma.oauthAccount.updateMany({
      where: { userId, authProvider, isDeleted: false },
      data: {
        isDeleted: true,
      },
    });

    if (result.count === 0) {
      throw new NotFoundException('OAuth account not found');
    }
  }

  /**
   * Get all OAuth accounts for user
   */
  async getUserOAuthAccounts(userId: string): Promise<{
    google: boolean;
    apple: boolean;
  }> {
    const accounts = await this.findByUserId(userId);

    return {
      google: accounts.some(acc => acc.authProvider === OAuthProvider.google),
      apple: accounts.some(acc => acc.authProvider === OAuthProvider.apple),
    };
  }

  /**
   * Check if user has OAuth account
   */
  async hasOAuthAccount(userId: string, authProvider: OAuthProvider): Promise<boolean> {
    const account = await this.prisma.oauthAccount.findFirst({
      where: { userId, authProvider, isDeleted: false },
      select: { id: true },
    });

    return !!account;
  }
}
