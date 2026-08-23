import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { MarketplacePrismaService } from '../../infrastructure/marketplace/marketplace-prisma.service';
import { AccountType } from '@prisma/marketplace-client';

export interface CreateAccountInput {
  centralUserId: string;
  accountType?: AccountType;
  displayName: string;
  phone?: string;
  email?: string;
  avatarUrl?: string;
  bio?: string;
}

export interface UpdateAccountInput {
  accountType?: AccountType;
  displayName?: string;
  phone?: string;
  email?: string;
  avatarUrl?: string;
  bio?: string;
}

@Injectable()
export class MarketplaceAccountService {
  constructor(private readonly marketplacePrisma: MarketplacePrismaService) {}

  async createAccount(input: CreateAccountInput) {
    const existing = await this.marketplacePrisma.marketplaceAccount.findUnique(
      {
        where: { centralUserId: input.centralUserId },
      },
    );

    if (existing) {
      throw new ConflictException(
        'Marketplace account already exists for this user',
      );
    }

    return this.marketplacePrisma.marketplaceAccount.create({
      data: {
        centralUserId: input.centralUserId,
        accountType: input.accountType || AccountType.INDIVIDUAL,
        displayName: input.displayName,
        phone: input.phone,
        email: input.email,
        avatarUrl: input.avatarUrl,
        bio: input.bio,
      },
    });
  }

  async getAccountByCentralUserId(centralUserId: string) {
    const account = await this.marketplacePrisma.marketplaceAccount.findUnique({
      where: { centralUserId },
      include: {
        listings: { where: { status: 'ACTIVE' }, take: 10 },
        _count: {
          select: { listings: true, inquiriesSent: true, favorites: true },
        },
      },
    });

    if (!account) {
      throw new NotFoundException('Marketplace account not found');
    }

    return account;
  }

  async getAccountById(id: string) {
    const account = await this.marketplacePrisma.marketplaceAccount.findUnique({
      where: { id },
      include: {
        listings: { where: { status: 'ACTIVE' }, take: 10 },
        _count: { select: { listings: true } },
      },
    });

    if (!account) {
      throw new NotFoundException('Marketplace account not found');
    }

    return account;
  }

  async updateAccount(centralUserId: string, input: UpdateAccountInput) {
    const account = await this.getAccountByCentralUserId(centralUserId);

    return this.marketplacePrisma.marketplaceAccount.update({
      where: { id: account.id },
      data: input,
    });
  }

  async setVerificationBadge(accountId: string, badge: string | null) {
    return this.marketplacePrisma.marketplaceAccount.update({
      where: { id: accountId },
      data: {
        verificationBadge: badge,
        isIdentityVerified: !!badge,
      },
    });
  }
}
