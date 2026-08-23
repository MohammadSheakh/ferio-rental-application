import { Injectable, Inject, Logger } from '@nestjs/common';
import { Redis } from 'ioredis';

import { REDIS_CLIENT } from '@app/redis';
import { PrismaService } from '@app/database';

/**
 * Socket Room Service
 * 
 * 📚 SOCKET.IO ROOM MANAGEMENT
 */
@Injectable()
export class SocketRoomService {
  private readonly logger = new Logger(SocketRoomService.name);
  private readonly KEYS = {
    // Room management
    USER_ROOMS: 'chat:user_rooms:',
    ROOM_USERS: 'chat:room_users:',

    // Task rooms
    TASK_ROOMS: 'task:rooms:',
    USER_TASKS: 'task:user_tasks:',

    // Group rooms
    GROUP_ROOMS: 'group:rooms:',
    USER_GROUPS: 'group:user_groups:',

    // Activity feed
    ACTIVITY_FEED: 'activity:feed:',
  };

  constructor(
    @Inject(REDIS_CLIENT) private redisClient: Redis,
    private prisma: PrismaService,
  ) {}

  // =============================================
  // Conversation Room Management
  // =============================================

  async joinRoom(userId: string, roomId: string): Promise<void> {
    const pipeline = this.redisClient.multi();

    pipeline.sadd(`${this.KEYS.USER_ROOMS}${userId}`, roomId);
    pipeline.sadd(`${this.KEYS.ROOM_USERS}${roomId}`, userId);

    await pipeline.exec();

    this.logger.log(`👥 User ${userId} joined room ${roomId}`);
  }

  async leaveRoom(userId: string, roomId: string): Promise<void> {
    const pipeline = this.redisClient.multi();

    pipeline.srem(`${this.KEYS.USER_ROOMS}${userId}`, roomId);
    pipeline.srem(`${this.KEYS.ROOM_USERS}${roomId}`, userId);

    await pipeline.exec();

    this.logger.log(`👥 User ${userId} left room ${roomId}`);
  }

  async getRoomUsers(roomId: string): Promise<string[]> {
    return await this.redisClient.smembers(`${this.KEYS.ROOM_USERS}${roomId}`);
  }

  async isUserInRoom(userId: string, roomId: string): Promise<boolean> {
    const isMember = await this.redisClient.sismember(`${this.KEYS.ROOM_USERS}${roomId}`, userId);
    return isMember === 1;
  }

  async getUserRooms(userId: string): Promise<string[]> {
    return await this.redisClient.smembers(`${this.KEYS.USER_ROOMS}${userId}`);
  }

  async removeUserFromAllRooms(userId: string): Promise<void> {
    const userRooms = await this.getUserRooms(userId);

    if (userRooms.length === 0) return;

    const pipeline = this.redisClient.multi();

    for (const roomId of userRooms) {
      pipeline.srem(`${this.KEYS.ROOM_USERS}${roomId}`, userId);
    }

    pipeline.del(`${this.KEYS.USER_ROOMS}${userId}`);

    await pipeline.exec();

    this.logger.log(`🧹 Removed user ${userId} from ${userRooms.length} rooms`);
  }

  // =============================================
  // Task Room Management
  // =============================================

  async joinTaskRoom(userId: string, taskId: string): Promise<void> {
    const pipeline = this.redisClient.multi();

    pipeline.sadd(`${this.KEYS.USER_TASKS}${userId}`, taskId);
    pipeline.sadd(`${this.KEYS.TASK_ROOMS}${taskId}`, userId);

    await pipeline.exec();

    this.logger.log(`📋 User ${userId} joined task room ${taskId}`);
  }

  async leaveTaskRoom(userId: string, taskId: string): Promise<void> {
    const pipeline = this.redisClient.multi();

    pipeline.srem(`${this.KEYS.USER_TASKS}${userId}`, taskId);
    pipeline.srem(`${this.KEYS.TASK_ROOMS}${taskId}`, userId);

    await pipeline.exec();

    this.logger.log(`📋 User ${userId} left task room ${taskId}`);
  }

  async getTaskRoomUsers(taskId: string): Promise<string[]> {
    return await this.redisClient.smembers(`${this.KEYS.TASK_ROOMS}${taskId}`);
  }

  async isUserInTaskRoom(userId: string, taskId: string): Promise<boolean> {
    const isMember = await this.redisClient.sismember(`${this.KEYS.USER_TASKS}${userId}`, taskId);
    return isMember === 1;
  }

  async getUserTaskRooms(userId: string): Promise<string[]> {
    return await this.redisClient.smembers(`${this.KEYS.USER_TASKS}${userId}`);
  }

  async removeUserFromAllTaskRooms(userId: string): Promise<void> {
    const userTaskRooms = await this.getUserTaskRooms(userId);

    if (userTaskRooms.length === 0) return;

    const pipeline = this.redisClient.multi();

    for (const taskId of userTaskRooms) {
      pipeline.srem(`${this.KEYS.TASK_ROOMS}${taskId}`, userId);
    }

    pipeline.del(`${this.KEYS.USER_TASKS}${userId}`);

    await pipeline.exec();

    this.logger.log(`🧹 Removed user ${userId} from ${userTaskRooms.length} task rooms`);
  }

  // =============================================
  // Group/Family Room Management
  // =============================================

  async joinGroupRoom(userId: string, groupId: string): Promise<void> {
    const pipeline = this.redisClient.multi();

    pipeline.sadd(`${this.KEYS.USER_GROUPS}${userId}`, groupId);
    pipeline.sadd(`${this.KEYS.GROUP_ROOMS}${groupId}`, userId);

    await pipeline.exec();

    this.logger.log(`👨‍👩‍👧‍👦 User ${userId} joined group room ${groupId}`);
  }

  async leaveGroupRoom(userId: string, groupId: string): Promise<void> {
    const pipeline = this.redisClient.multi();

    pipeline.srem(`${this.KEYS.USER_GROUPS}${userId}`, groupId);
    pipeline.srem(`${this.KEYS.GROUP_ROOMS}${groupId}`, userId);

    await pipeline.exec();

    this.logger.log(`👨‍👩‍👧‍👦 User ${userId} left group room ${groupId}`);
  }

  async getGroupRoomUsers(groupId: string): Promise<string[]> {
    return await this.redisClient.smembers(`${this.KEYS.GROUP_ROOMS}${groupId}`);
  }

  async isUserInGroupRoom(userId: string, groupId: string): Promise<boolean> {
    const isMember = await this.redisClient.sismember(`${this.KEYS.USER_GROUPS}${userId}`, groupId);
    return isMember === 1;
  }

  async getUserGroupRooms(userId: string): Promise<string[]> {
    return await this.redisClient.smembers(`${this.KEYS.USER_GROUPS}${userId}`);
  }

  async removeUserFromAllGroupRooms(userId: string): Promise<void> {
    const userGroupRooms = await this.getUserGroupRooms(userId);

    if (userGroupRooms.length === 0) return;

    const pipeline = this.redisClient.multi();

    for (const groupId of userGroupRooms) {
      pipeline.srem(`${this.KEYS.GROUP_ROOMS}${groupId}`, userId);
    }

    pipeline.del(`${this.KEYS.USER_GROUPS}${userId}`);

    await pipeline.exec();

    this.logger.log(`🧹 Removed user ${userId} from ${userGroupRooms.length} group rooms`);
  }

  /**
   * Auto-join Family Room
   */
  async autoJoinFamilyRoom(socket: any, userId: string): Promise<void> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, role: true, accountCreatorId: true },
      });

      if (!user) return;

      let familyRoomId: string | null = null;

      if ((user.role as string) === 'child' && user.accountCreatorId) {
        familyRoomId = user.accountCreatorId;
        this.logger.log(`👨‍👩‍👧‍👦 User ${userId} joining family room ${familyRoomId} (as child)`);
      } else if ((user.role as string) === 'business') {
        familyRoomId = userId;
        this.logger.log(`👨‍👩‍👧‍👦 User ${userId} joining family room ${familyRoomId} (as business user)`);
      }

      if (familyRoomId) {
        await this.joinGroupRoom(userId, familyRoomId);
        socket.join(familyRoomId);
        this.logger.log(`✅ User ${userId} auto-joined family room ${familyRoomId}`);
      }
    } catch (error) {
      this.logger.error(`❌ Error auto-joining family room: ${error.message}`);
    }
  }

  // =============================================
  // Activity Feed Management
  // =============================================

  async addActivityToFeed(groupId: string, activity: any, maxActivities: number = 50): Promise<void> {
    const activityKey = `${this.KEYS.ACTIVITY_FEED}${groupId}`;

    await this.redisClient.lpush(activityKey, JSON.stringify(activity));
    await this.redisClient.ltrim(activityKey, 0, maxActivities - 1);
    await this.redisClient.expire(activityKey, 7 * 24 * 60 * 60);

    this.logger.log(`📢 Added activity to group ${groupId} feed`);
  }

  async getActivityFeed(groupId: string, limit: number = 10): Promise<any[]> {
    const activityKey = `${this.KEYS.ACTIVITY_FEED}${groupId}`;
    const activities = await this.redisClient.lrange(activityKey, 0, limit - 1);
    return activities.map(activity => JSON.parse(activity));
  }

  async clearActivityFeed(groupId: string): Promise<void> {
    const activityKey = `${this.KEYS.ACTIVITY_FEED}${groupId}`;
    await this.redisClient.del(activityKey);
    this.logger.log(`🧹 Cleared activity feed for group ${groupId}`);
  }
}
