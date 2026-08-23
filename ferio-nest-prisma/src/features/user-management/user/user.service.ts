import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { RedisService } from '@app/redis';
import { PrismaService } from '@app/database';
import { USER_CACHE_CONFIG } from './user.constants';
import { UpdateProfileDto } from './dto/update-profile.dto';

const publicUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  profileImageUrl: true,
  phoneNumber: true,
  isEmailVerified: true,
  authProvider: true,
  preferredTime: true,
  isResetPassword: true,
  isDeleted: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

const userWithPasswordSelect = {
  ...publicUserSelect,
  password: true,
} satisfies Prisma.UserSelect;

type PublicUserRecord = Prisma.UserGetPayload<{
  select: typeof publicUserSelect;
}>;

type UserWithPasswordRecord = Prisma.UserGetPayload<{
  select: typeof userWithPasswordSelect;
}>;

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
  ) {}

  private getCacheKey(type: 'profile' | 'stats', id: string): string {
    return type === 'profile' 
      ? `${USER_CACHE_CONFIG.PREFIX}:${id}` 
      : `${USER_CACHE_CONFIG.PREFIX}:stats:${id}`;
  }

  async findById(id: string): Promise<PublicUserRecord | null> {
    return this.prisma.user.findUnique({
      where: { id, isDeleted: false },
      select: publicUserSelect,
    });
  }

  async findByEmail(
    email: string,
    includePassword = false,
  ): Promise<PublicUserRecord | UserWithPasswordRecord | null> {
    return this.prisma.user.findFirst({
      where: {
        email: email.toLowerCase(),
        isDeleted: false,
      },
      select: includePassword ? userWithPasswordSelect : publicUserSelect,
    });
  }

  /**
   * Update user and their profile (nested)
   * This is explicit and safe.
   */
  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<PublicUserRecord | null> {
    const { name, phoneNumber, email, ...profileData } = dto as any;

    const updateData: Prisma.UserUpdateInput = {};
    if (name) updateData.name = name;
    if (phoneNumber) updateData.phoneNumber = phoneNumber;
    if (email) updateData.email = email;

    if (Object.keys(profileData).length > 0) {
      updateData.ownedProfile = {
        upsert: {
          create: { ...profileData },
          update: { ...profileData },
        },
      };
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: publicUserSelect,
    });

    if (updatedUser) {
      await this.invalidateCache(userId);
    }

    return updatedUser;
  }

  async findByIdWithCache(id: string): Promise<PublicUserRecord | null> {
    return this.redisService.getOrSet(
      this.getCacheKey('profile', id),
      () => this.fetchUserById(id),
      USER_CACHE_CONFIG.PROFILE
    );
  }

  private async fetchUserById(id: string): Promise<PublicUserRecord | null> {
    return this.findById(id);
  }

  async invalidateCache(id: string): Promise<void> {
    const keys = USER_CACHE_CONFIG.INVALIDATION_PATTERNS.PROFILE_UPDATED(id);
    await this.redisService.invalidate(keys as any);
    this.logger.log(`Invalidated cache for user: ${id}`);
  }

  async updatePreferredTime(userId: string, preferredTime: string): Promise<PublicUserRecord | null> {
    const result = await this.prisma.user.update({
      where: { id: userId },
      data: { preferredTime },
      select: publicUserSelect,
    });
    if (result) await this.invalidateCache(userId);
    return result;
  }

  async getUserStatistics(userId: string) {
    return this.redisService.getOrSet(
      this.getCacheKey('stats', userId),
      () => this.fetchUserStatistics(userId),
      USER_CACHE_CONFIG.STATISTICS
    );
  }

  private async fetchUserStatistics(userId: string) {
    const baseWhere = {
      isDeleted: false,
      OR: [{ accountCreatorId: userId }], 
    };
    const totalChildren = await this.prisma.user.count({ where: baseWhere });
    return { totalChildren };
  }
}
