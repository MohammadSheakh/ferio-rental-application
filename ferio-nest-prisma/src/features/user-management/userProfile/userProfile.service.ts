import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { Prisma, UserProfile } from '@prisma/client';

import { GenericService } from '@app/common';
import { PrismaService } from '@app/database';
import { RedisService } from '@app/redis';
import { USER_CACHE_CONFIG } from '../user/user.constants';


const publicUserProfileSelect = {
  id: true,
  isDeleted: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserProfileSelect;

type UserProfileRecord = Prisma.UserProfileGetPayload<{
  select: typeof publicUserProfileSelect;
}>;


/**
 * UserProfile Service
 */
@Injectable()
export class UserProfileService extends GenericService<Prisma.UserProfileDelegate, UserProfileRecord> {
  private readonly logger = new Logger(UserProfileService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
  ) {
    super(prisma.userProfile, publicUserProfileSelect);
  }

  private getCacheKey(userId: string): string {
    return `${USER_CACHE_CONFIG.PREFIX}:profile:${userId}`;
  }

  /**
   * Find profile by user ID with cache
   */
  async findByUserIdWithCache(userId: string): Promise<UserProfile | null> {
    return this.redisService.getOrSet(
      this.getCacheKey(userId),
      () => this.fetchProfileByUserId(userId),
      USER_CACHE_CONFIG.PROFILE
    );
  }

  private async fetchProfileByUserId(userId: string) {
    return this.prisma.userProfile.findFirst({
      where: { userId, isDeleted: false },
    });
  }

  /**
   * Update profile with targeted invalidation
   */
  async updateByUserId(
    userId: string,
    data: Prisma.UserProfileUpdateInput,
  ): Promise<UserProfile | null> {
    const profile = await this.prisma.userProfile.findFirst({
      where: { userId, isDeleted: false },
    });

    if (!profile) {
      throw new NotFoundException('User profile not found');
    }

    const result = await this.prisma.userProfile.update({
      where: { userId },
      data,
    });

    if (result) {
      await this.invalidateCache(userId);
    }

    return result;
  }

  /**
   * Invalidate profile cache using patterns
   */
  async invalidateCache(userId: string): Promise<void> {
    const keys = [
      this.getCacheKey(userId),
      ...USER_CACHE_CONFIG.INVALIDATION_PATTERNS.PROFILE_UPDATED(userId)
    ];
    await this.redisService.invalidate(keys);
    this.logger.debug(`Invalidated cache for user profile: ${userId}`);
  }

  /**
   * Update support mode preference
   */
  async updateSupportMode(userId: string, supportMode: string): Promise<UserProfile | null> {
    return this.updateByUserId(userId, { supportMode });
  }

  /**
   * Update notification style preference
   */
  async updateNotificationStyle(userId: string, notificationStyle: string): Promise<UserProfile | null> {
    return this.updateByUserId(userId, { notificationStyle });
  }

  /**
   * Get profile with user details
   */
  async getProfileWithUser(userId: string): Promise<any> {
    const profile = await this.findByUserIdWithCache(userId);

    if (!profile) {
      throw new NotFoundException('User profile not found');
    }

    return await this.prisma.userProfile.findFirst({
      where: { userId, isDeleted: false },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            profileImageUrl: true,
            role: true,
          },
        },
      },
    });
  }
}
