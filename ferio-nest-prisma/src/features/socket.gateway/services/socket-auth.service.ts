import { Injectable, Inject, Logger, OnModuleInit } from '@nestjs/common';
import { Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { Redis } from 'ioredis';
import { REDIS_CLIENT } from '@app/redis';
import { PrismaService } from '@app/database';

export interface SocketUser {
  userId: string;
  role: string;
  name: string;
}

const ADMIN_ROLES = new Set(['admin', 'super_admin', 'super-admin']);
const GUEST_ID_PATTERN = /^gst_[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface UserConnectionInfo {
  socketId: string;
  workerId: string;
  connectedAt: number;
  userInfo?: any;
}

/**
 * Socket Auth Service
 * 
 * 📚 SOCKET.IO AUTHENTICATION & USER TRACKING
 */
@Injectable()
export class SocketAuthService implements OnModuleInit {
  private readonly logger = new Logger(SocketAuthService.name);
  private readonly KEYS = {
    ONLINE_USERS: 'chat:online_users',
    USER_SOCKET_MAP: 'chat:user_socket_map:',
    SOCKET_USER_MAP: 'chat:socket_user_map:',
    USER_STATUS: 'chat:user_status:',
  };

  constructor(
    private jwtService: JwtService,
    @Inject(REDIS_CLIENT) private redisClient: Redis,
    private prisma: PrismaService,
  ) {}

  onModuleInit() {
    this.startCleanupJob();
  }

  /**
   * Authenticate Socket Connection
   */
  async authenticateSocket(socket: Socket): Promise<SocketUser | null> {
    try {
      const token = socket.handshake.auth?.token || (socket.handshake.headers?.token as string);
      const guestId = socket.handshake.auth?.guestId || (socket.handshake.query?.guestId as string);

      if (!token) {
        return {
          userId: this.normalizeGuestId(guestId) || `guest_${socket.id.slice(0, 8)}`,
          role: 'guest',
          name: 'Guest Visitor',
        };
      }

      // Verify JWT token
      try {
        const payload = await this.jwtService.verifyAsync(token, {
          secret: process.env.JWT_ACCESS_SECRET || 'fallback-secret',
        });

        if (payload?.purpose === 'chat_socket' && payload.userId && payload.role === 'guest') {
          const normalizedGuestId = this.normalizeGuestId(payload.userId);
          return {
            userId: normalizedGuestId || `guest_${socket.id.slice(0, 8)}`,
            role: 'guest',
            name: 'Guest Visitor',
          };
        }

        const targetId = payload?.userId || payload?.sub || payload?.id;

        if (targetId) {
          const user = await this.prisma.user.findUnique({
            where: { id: targetId },
            select: { id: true, role: true, name: true },
          });

          if (user) {
            return {
              userId: user.id,
              role: user.role,
              name: user.name,
            };
          }

          // Check DeliveryPersonnel table for rider tokens
          const rider = await this.prisma.deliveryPersonnel.findUnique({
            where: { id: targetId },
            select: { id: true, name: true },
          });

          if (rider) {
            return {
              userId: rider.id,
              role: 'delivery_man',
              name: rider.name || 'Delivery Rider',
            };
          }

          return null;
        }
      } catch {
        // A supplied credential must either verify or fail closed. Anonymous
        // guests connect without a token and follow the explicit path above.
        return null;
      }

      return null;
    } catch (error) {
      this.logger.warn(`⚠️ Socket authentication failed: ${error.message}`);
      return {
        userId: `guest_${socket.id.slice(0, 8)}`,
        role: 'guest',
        name: 'Guest Visitor',
      };
    }
  }

  issueSocketTicket(user: { userId: string; email?: string; role: string }) {
    return this.jwtService.signAsync(
      {
        userId: user.userId,
        email: user.email || '',
        role: user.role,
        purpose: 'chat_socket',
      },
      {
        secret: process.env.JWT_ACCESS_SECRET,
        expiresIn: '5m',
      },
    );
  }

  issueGuestSocketTicket(guestId: string) {
    const normalizedGuestId = this.normalizeGuestId(guestId);
    if (!normalizedGuestId) return null;
    return this.issueSocketTicket({ userId: normalizedGuestId, role: 'guest' });
  }

  async canAccessConversation(user?: SocketUser | null, conversationId?: string): Promise<boolean> {
    if (!user || !conversationId) return false;
    if (this.isAdmin(user.role)) return true;

    const allowedIds = new Set([user.userId, `conv-${user.userId}`]);
    if (user.role !== 'guest' && user.userId) {
      const account = await this.prisma.user.findUnique({
        where: { id: user.userId },
        select: { customerId: true },
      });
      if (account?.customerId) {
        allowedIds.add(account.customerId);
        allowedIds.add(`conv-${account.customerId}`);
      }
    }

    return allowedIds.has(conversationId);
  }

  isAdmin(role?: string) {
    return ADMIN_ROLES.has(String(role || '').toLowerCase());
  }

  private normalizeGuestId(guestId?: string) {
    if (!guestId || !GUEST_ID_PATTERN.test(guestId)) return null;
    return guestId.toLowerCase();
  }

  /**
   * Handle User Connection
   */
  async handleUserConnection(socket: Socket, user: { userId: string; role: string }): Promise<string | null> {
    const userId = user.userId;
    const socketId = socket.id;
    const workerId = process.pid.toString();

    // Check for existing connection
    const existingInfo = await this.getUserConnectionInfo(userId);

    if (existingInfo && existingInfo.socketId !== socketId) {
      this.logger.log(
        `🔄 User ${userId} reconnecting. Old socket: ${existingInfo.socketId}, New socket: ${socketId}`,
      );

      // Clean up old socket mapping
      await this.redisClient.del(`${this.KEYS.SOCKET_USER_MAP}${existingInfo.socketId}`);

      // Return old socket ID so caller can disconnect it
      return existingInfo.socketId;
    }

    // Add new connection
    await this.addOnlineUser(userId, socketId, workerId, user);

    this.logger.log(`✅ User ${userId} connected (Socket: ${socketId}, Worker: ${workerId})`);

    return null;
  }

  /**
   * Handle User Disconnection
   */
  async handleUserDisconnection(socket: Socket, userId: string): Promise<void> {
    const socketId = socket.id;

    this.logger.log(`🔌 User disconnected: ${userId} (Socket: ${socketId})`);

    try {
      // Remove from Redis state
      await this.removeOnlineUser(userId, socketId);
    } catch (error) {
      this.logger.error(`❌ Error handling user disconnection: ${error.message}`);
    }
  }

  async getUserProfile(userId: string) {
    return await this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });
  }

  /**
   * Add Online User to Redis
   */
  private async addOnlineUser(
    userId: string,
    socketId: string,
    workerId: string,
    userInfo?: any,
  ): Promise<void> {
    const pipeline = this.redisClient.multi();

    // Add to online users set
    pipeline.sadd(this.KEYS.ONLINE_USERS, userId);

    // Store user-socket mapping
    pipeline.hset(`${this.KEYS.USER_SOCKET_MAP}${userId}`, {
      socketId,
      workerId,
      connectedAt: Date.now().toString(),
      userInfo: JSON.stringify(userInfo || {}),
    });

    // Store socket-user mapping
    pipeline.hset(`${this.KEYS.SOCKET_USER_MAP}${socketId}`, {
      userId,
    });

    // Set user status
    pipeline.hset(`${this.KEYS.USER_STATUS}${userId}`, {
      isOnline: 'true',
      lastSeen: Date.now().toString(),
      workerId,
    });

    await pipeline.exec();

    this.logger.debug(`✅ User ${userId} added to Redis state (Worker: ${workerId})`);
  }

  /**
   * Remove Online User from Redis
   */
  private async removeOnlineUser(userId: string, socketId: string): Promise<void> {
    const pipeline = this.redisClient.multi();

    // Remove from online users set
    pipeline.srem(this.KEYS.ONLINE_USERS, userId);

    // Remove user-socket mapping
    pipeline.del(`${this.KEYS.USER_SOCKET_MAP}${userId}`);

    // Remove socket-user mapping
    pipeline.del(`${this.KEYS.SOCKET_USER_MAP}${socketId}`);

    // Update user status to offline
    pipeline.hset(`${this.KEYS.USER_STATUS}${userId}`, {
      isOnline: 'false',
      lastSeen: Date.now().toString(),
    });

    await pipeline.exec();

    this.logger.debug(`❌ User ${userId} removed from Redis state`);
  }

  /**
   * Get User Connection Info
   */
  async getUserConnectionInfo(userId: string): Promise<UserConnectionInfo | null> {
    const info = await this.redisClient.hgetall(`${this.KEYS.USER_SOCKET_MAP}${userId}`);

    if (!info || Object.keys(info).length === 0) {
      return null;
    }

    return {
      socketId: info.socketId,
      workerId: info.workerId,
      connectedAt: parseInt(info.connectedAt, 10),
      userInfo: info.userInfo ? JSON.parse(info.userInfo) : undefined,
    };
  }

  /**
   * Check if User is Online
   */
  async isUserOnline(userId: string): Promise<boolean> {
    const isMember = await this.redisClient.sismember(this.KEYS.ONLINE_USERS, userId);
    return isMember === 1;
  }

  /**
   * Get All Online Users
   */
  async getAllOnlineUsers(): Promise<string[]> {
    return await this.redisClient.smembers(this.KEYS.ONLINE_USERS);
  }

  /**
   * Get Related Online Users
   * 
   * Returns online users that the current user is related to (family or conversations)
   */
  async getRelatedOnlineUsers(userId: string): Promise<string[]> {
    try {
      const allOnlineUsers = await this.getAllOnlineUsers();
      if (allOnlineUsers.length === 0) return [];

      const relatedUserIds = new Set<string>();

      // 1. Get family-related users from Prisma
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, accountCreatorId: true, childAccounts: { select: { id: true } } },
      });

      if (user) {
        if (user.accountCreatorId) relatedUserIds.add(user.accountCreatorId);
        user.childAccounts.forEach(child => relatedUserIds.add(child.id));
      }

      // 2. Get conversation-related users from Prisma
      const userParticipations = await this.prisma.conversationParticipents.findMany({
        where: {
          userId,
          isDeleted: false,
        },
        select: { conversationId: true },
      });

      if (userParticipations.length > 0) {
        const conversationIds = userParticipations.map((p) => p.conversationId);
        const otherParticipants = await this.prisma.conversationParticipents.findMany({
          where: {
            conversationId: { in: conversationIds },
            userId: { not: userId },
            isDeleted: false,
          },
          select: { userId: true },
        });

        otherParticipants.forEach((p) => relatedUserIds.add(p.userId));
      }

      // Filter only those who are online
      const relatedOnlineUsers = allOnlineUsers.filter(onlineId => 
        relatedUserIds.has(onlineId) || onlineId === userId
      );

      return relatedOnlineUsers;
    } catch (error) {
      this.logger.error(`❌ Error getting related online users: ${error.message}`);
      return [];
    }
  }

  /**
   * Get Online Users Count
   */
  async getOnlineUsersCount(): Promise<number> {
    return await this.redisClient.scard(this.KEYS.ONLINE_USERS);
  }

  /**
   * Get System Stats
   */
  async getSystemStats(): Promise<any> {
    return {
      totalOnlineUsers: await this.getOnlineUsersCount(),
      onlineUsers: await this.getAllOnlineUsers(),
      timestamp: Date.now(),
    };
  }

  /**
   * Start Cleanup Job
   */
  private startCleanupJob() {
    setInterval(async () => {
      try {
        const onlineUsers = await this.getAllOnlineUsers();
        const staleThreshold = Date.now() - 5 * 60 * 1000; // 5 minutes

        for (const userId of onlineUsers) {
          const connectionInfo = await this.getUserConnectionInfo(userId);

          if (connectionInfo && connectionInfo.connectedAt < staleThreshold) {
            this.logger.warn(`🧹 Cleaning up stale connection for user ${userId}`);
            await this.removeOnlineUser(userId, connectionInfo.socketId);
          }
        }
      } catch (error) {
        this.logger.error(`❌ Error in cleanup job: ${error.message}`);
      }
    }, 5 * 60 * 1000); // Every 5 minutes
  }
}
