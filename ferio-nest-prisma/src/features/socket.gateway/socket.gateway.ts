import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards, Inject } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createAdapter } from '@socket.io/redis-adapter';
import { Redis } from 'ioredis';

import { SocketAuthService } from './services/socket-auth.service';
import { SocketRoomService } from './services/socket-room.service';
import { WsJwtGuard } from './guards/ws-jwt.guard';
import { REDIS_PUB_CLIENT, REDIS_SUB_CLIENT } from '@app/redis';
import { FirebaseService } from '@app/notification';
import { PrismaService } from '@app/database';

const socketAllowedOrigins = [
  process.env.CUSTOMER_WEB_URL || 'http://localhost:3000',
  process.env.ADMIN_WEB_URL || 'http://localhost:3001',
  ...(process.env.SOCKET_ALLOWED_ORIGINS || '').split(','),
]
  .map((origin) => origin.trim())
  .filter(Boolean);

/**
 * Socket.IO Gateway
 * 
 * 📚 REAL-TIME NOTIFICATION & CHAT GATEWAY
 */
@WebSocketGateway(Number(process.env.SOCKET_PORT) || 6734, {
  cors: {
    origin: socketAllowedOrigins,
    credentials: true,
  },
  path: '/socket.io',
})
export class SocketGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(SocketGateway.name);
  private activePageViews = new Map<
    string,
    { socketId: string; page: string; role: string; userId: string; name?: string; updatedAt: number }
  >();

  constructor(
    private jwtService: JwtService,
    private socketAuthService: SocketAuthService,
    private socketRoomService: SocketRoomService,
    private firebaseService: FirebaseService,
    private prisma: PrismaService,
    @Inject(REDIS_PUB_CLIENT) private redisPubClient: Redis,
    @Inject(REDIS_SUB_CLIENT) private redisSubClient: Redis,
  ) {}

  /**
   * Gateway Initialization
   */
  afterInit(server: Server) {
    this.logger.log('✅ Socket.IO Gateway initialized');
    
    // Attach Redis adapter for multi-worker support
    try {
      const adapter = createAdapter(this.redisPubClient, this.redisSubClient);
      server.adapter(adapter);
      this.logger.log('✅ Redis adapter attached to Socket.IO server');
    } catch (error) {
      this.logger.error(`❌ Failed to attach Redis adapter: ${error.message}`);
    }
  }

  /**
   * Handle Client Connection
   */
  async handleConnection(@ConnectedSocket() client: Socket) {
    try {
      // Authenticate user
      const user = await this.socketAuthService.authenticateSocket(client);

      if (!user) {
        this.logger.warn(`❌ Socket authentication failed: ${client.id}`);
        client.emit('io-error', {
          success: false,
          message: 'Authentication failed',
        });
        client.disconnect();
        return;
      }

      // Store user in socket data
      client.data.user = user;
      client.data.userId = user.userId;

      this.logger.log(
        `🔌 User connected: ${user.userId} (Socket: ${client.id})`,
      );

      // Handle user connection in Redis
      await this.socketAuthService.handleUserConnection(client, user);

      // Auto-join user's personal room & conversation room
      client.join(user.userId);
      client.join(`conv-${user.userId}`);
      this.logger.log(`✅ User ${user.userId} joined rooms: ${user.userId}, conv-${user.userId}`);

      // Auto-join role-based room
      if (user.role) {
        const lowerRole = String(user.role).toLowerCase();
        client.join(`role::${user.role}`);
        client.join(`role::${lowerRole}`);

        if (['admin', 'super_admin', 'super-admin'].includes(lowerRole)) {
          client.join('role::admin');
          client.join('role::super-admin');
          client.join('admin-room');
          this.logger.log(`✅ Admin user ${user.userId} joined admin role rooms`);
        }
      }

      // Auto-join family room (if applicable)
      await this.socketRoomService.autoJoinFamilyRoom(client, user.userId);

      // Notify related users about online status
      await this.notifyRelatedUsersOnlineStatus(user.userId, true);

      // Track initial page view for visitors on storefront / rider portal pages
      const initialPage = (client.handshake.query?.page as string) || '/';
      const isDashboardPage = initialPage.toLowerCase().includes('/dashboard');

      if (!isDashboardPage) {
        this.activePageViews.set(client.id, {
          socketId: client.id,
          page: initialPage,
          role: user.role || 'guest',
          userId: user.userId || client.id,
          name: user.name || 'Guest Visitor',
          updatedAt: Date.now(),
        });
        this.broadcastLivePageStats();
      }

      // Emit connection success
      client.emit('connected', {
        success: true,
        userId: user.userId,
        socketId: client.id,
      });
    } catch (error) {
      this.logger.error(`❌ Connection error: ${error.message}`);
      client.emit('io-error', {
        success: false,
        message: 'Connection error',
      });
      client.disconnect();
    }
  }

  /**
   * Handle Client Disconnection
   */
  async handleDisconnect(@ConnectedSocket() client: Socket) {
    const userId = client.data.userId;

    if (this.activePageViews.has(client.id)) {
      this.activePageViews.delete(client.id);
      this.broadcastLivePageStats();
    }

    if (userId) {
      this.logger.log(`🔌 User disconnected: ${userId} (Socket: ${client.id})`);

      // Handle user disconnection in Redis
      await this.socketAuthService.handleUserDisconnection(client, userId);

      // Notify related users about online status
      await this.notifyRelatedUsersOnlineStatus(userId, false);
    }
  }

  /**
   * Handle Real-Time Page View Tracking from Web Clients
   */
  @SubscribeMessage('page-view')
  handlePageView(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { page: string; title?: string },
  ) {
    if (!data || typeof data.page !== 'string') return;
    const page = data.page;
    client.data.currentPage = page;

    const user = client.data.user;
    const isDashboardPage = page.toLowerCase().includes('/dashboard');

    if (!isDashboardPage) {
      this.activePageViews.set(client.id, {
        socketId: client.id,
        page,
        role: user?.role || 'guest',
        userId: client.data.userId || client.id,
        name: user?.name || 'Guest Visitor',
        updatedAt: Date.now(),
      });
      this.broadcastLivePageStats();
    }
  }

  public getLivePageStatsPayload() {
    const pageCounts: Record<string, number> = {
      '/': 0,
      '/cart': 0,
      '/checkout': 0,
      '/track': 0,
      '/products': 0,
      '/delivery/portal': 0,
    };

    let totalActive = 0;
    const activeVisitors: Array<{ page: string; role: string; name: string; userId: string }> = [];

    for (const [socketId, info] of this.activePageViews.entries()) {
      totalActive++;
      let rawPage = info.page.split('?')[0];
      if (!rawPage || rawPage === '') rawPage = '/';

      let cleanPage = rawPage;
      const lowerPage = rawPage.toLowerCase().trim();
      if (lowerPage.startsWith('/delivery') || lowerPage.includes('delivery')) {
        cleanPage = '/delivery/portal';
      } else if (lowerPage.startsWith('/products') || lowerPage.startsWith('/catalog') || lowerPage.startsWith('/shop')) {
        cleanPage = '/products';
      } else if (lowerPage.startsWith('/track')) {
        cleanPage = '/track';
      } else if (lowerPage.startsWith('/cart')) {
        cleanPage = '/cart';
      } else if (lowerPage.startsWith('/checkout')) {
        cleanPage = '/checkout';
      } else if (lowerPage.startsWith('/account')) {
        cleanPage = '/account';
      } else if (lowerPage === '/' || lowerPage === '') {
        cleanPage = '/';
      }

      pageCounts[cleanPage] = (pageCounts[cleanPage] || 0) + 1;
      activeVisitors.push({
        page: cleanPage,
        role: info.role,
        name: info.name || 'Guest Visitor',
        userId: info.userId,
      });
    }

    return {
      totalActive,
      pageCounts,
      activeVisitors,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Admin Request for Immediate Live Page Stats Hydration
   */
  @SubscribeMessage('request-live-page-stats')
  handleRequestLivePageStats(@ConnectedSocket() client: Socket) {
    const payload = this.getLivePageStatsPayload();
    client.emit('live-page-visitors-stats', payload);
    this.broadcastLivePageStats();
    return { success: true };
  }

  /**
   * Broadcast Live Active Page Visitor Metrics to Admin Room
   */
  public broadcastLivePageStats() {
    const payload = this.getLivePageStatsPayload();
    this.server
      .to('role::admin')
      .to('role::super-admin')
      .to('admin-room')
      .emit('live-page-visitors-stats', payload);
  }

  /**
   * Notify Related Users about Online Status
   */
  private async notifyRelatedUsersOnlineStatus(userId: string, isOnline: boolean) {
    try {
      const relatedUsers = await this.socketAuthService.getRelatedOnlineUsers(userId);

      for (const relatedUserId of relatedUsers) {
        // Don't notify self
        if (relatedUserId === userId) continue;

        this.server.to(relatedUserId).emit(`related-user-online-status::${relatedUserId}`, {
          userId,
          isOnline,
        });
      }
    } catch (error) {
      this.logger.error(`❌ Failed to notify related users: ${error.message}`);
    }
  }

  /**
   * Join Conversation Room
   */
  @SubscribeMessage('join')
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    try {
      const userId = client.data.userId;
      const { conversationId } = data;

      if (!conversationId) {
        return { success: false, message: 'conversationId is required' };
      }

      if (!(await this.socketAuthService.canAccessConversation(client.data.user, conversationId))) {
        return { success: false, message: 'Conversation access denied' };
      }

      // Join Socket.IO room
      client.join(conversationId);

      // Update Redis state
      await this.socketRoomService.joinRoom(userId, conversationId);

      // Get room users
      const roomUsers = await this.socketRoomService.getRoomUsers(conversationId);

      this.logger.log(
        `👥 Room ${conversationId} has ${roomUsers.length} users: ${roomUsers.join(', ')}`,
      );

      // Notify others in the chat
      client.to(conversationId).emit('user-joined-chat', {
        userId,
        userName: client.data.user?.name,
        conversationId,
        isOnline: true,
      });

      return {
        success: true,
        message: 'Joined conversation successfully',
        roomUsers,
      };
    } catch (error) {
      this.logger.error(`❌ Join room error: ${error.message}`);
      return { success: false, message: 'Failed to join room' };
    }
  }

  /**
   * Leave Conversation Room
   */
  @SubscribeMessage('leave')
  async handleLeaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    try {
      const userId = client.data.userId;
      const { conversationId } = data;

      if (!conversationId) {
        return { success: false, message: 'conversationId is required' };
      }

      // Leave Socket.IO room
      client.leave(conversationId);

      // Update Redis state
      await this.socketRoomService.leaveRoom(userId, conversationId);

      // Notify others
      client.to(conversationId).emit('user-left-chat', {
        userId,
        userName: client.data.user?.name,
        conversationId,
      });

      return { success: true, message: 'Left conversation successfully' };
    } catch (error) {
      this.logger.error(`❌ Leave room error: ${error.message}`);
      return { success: false, message: 'Failed to leave room' };
    }
  }

  /**
   * Handle Real-Time Chat Message Relay
   */
  @SubscribeMessage('new-message-received')
  async handleNewMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: any,
  ) {
    try {
      const { conversationId } = data || {};
      const user = client.data?.user;
      const userId = user?.userId;
      const targetConvId = conversationId || `conv-${userId}`;
      const text = typeof data?.text === 'string' ? data.text.trim().slice(0, 4000) : '';

      if (!userId || !text || !(await this.socketAuthService.canAccessConversation(user, targetConvId))) {
        return { success: false, message: 'Conversation access denied' };
      }

      const isAdmin = this.socketAuthService.isAdmin(user.role);
      const isGuest = user.role === 'guest';
      const rawTargetId = targetConvId.replace(/^conv-/, '');
      const targetGuestId = isGuest
        ? userId
        : isAdmin && rawTargetId.startsWith('gst_')
          ? rawTargetId
          : undefined;

      const payload = {
        _messageId: data?._messageId || `msg_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        conversationId: targetConvId,
        text: text || '',
        senderId: userId,
        senderName: user.name || (isGuest ? 'Guest Visitor' : 'Customer'),
        createdAt: data?.createdAt || new Date().toISOString(),
        isGuest,
        guestId: targetGuestId,
        isAdmin,
      };

      this.logger.log(`💬 Socket Message Relay: [${payload.senderName}] in [${targetConvId}]: "${payload.text}"`);

      // 1. Broadcast to target conversation room & prefixed room
      const rawConvId = targetConvId.replace(/^conv-/, '');
      const prefConvId = targetConvId.startsWith('conv-') ? targetConvId : `conv-${targetConvId}`;

      // 1. Target Room Emission (broadcast to both raw and conv- prefixed rooms)
      this.server.to(targetConvId).emit('new-message-received', payload);
      // Lookup target user and customer links to emit to all related rooms (Customer ID & User ID & Email)
      const targetIdToSearch = rawConvId;
      const [linkedUser, linkedCustomer] = await Promise.all([
        this.prisma.user.findFirst({
          where: {
            isDeleted: false,
            OR: [
              { id: targetIdToSearch },
              { customerId: targetIdToSearch },
              { id: rawConvId },
              { customerId: rawConvId },
            ],
          },
          select: { id: true, customerId: true, email: true },
        }),
        this.prisma.customer.findFirst({
          where: {
            OR: [
              { id: targetIdToSearch },
              { id: rawConvId },
            ],
          },
          include: { user: true },
        }),
      ]);

      const roomsToEmit = new Set<string>([rawConvId, prefConvId]);

      if (linkedUser) {
        if (linkedUser.id) {
          roomsToEmit.add(linkedUser.id);
          roomsToEmit.add(`conv-${linkedUser.id}`);
        }
        if (linkedUser.customerId) {
          roomsToEmit.add(linkedUser.customerId);
          roomsToEmit.add(`conv-${linkedUser.customerId}`);
        }
      }

      if (linkedCustomer) {
        if (linkedCustomer.id) {
          roomsToEmit.add(linkedCustomer.id);
          roomsToEmit.add(`conv-${linkedCustomer.id}`);
        }
        if (linkedCustomer.user?.id) {
          roomsToEmit.add(linkedCustomer.user.id);
          roomsToEmit.add(`conv-${linkedCustomer.user.id}`);
        }
      }

      // Cross-lookup by email if available
      const searchEmail = linkedUser?.email || linkedCustomer?.email;
      if (searchEmail) {
        const [userByEmail, custByEmail] = await Promise.all([
          this.prisma.user.findFirst({ where: { email: searchEmail } }),
          this.prisma.customer.findFirst({
            where: { email: searchEmail },
            include: { user: true },
          }),
        ]);
        if (userByEmail) {
          roomsToEmit.add(userByEmail.id);
          roomsToEmit.add(`conv-${userByEmail.id}`);
          if (userByEmail.customerId) {
            roomsToEmit.add(userByEmail.customerId);
            roomsToEmit.add(`conv-${userByEmail.customerId}`);
          }
        }
        if (custByEmail) {
          roomsToEmit.add(custByEmail.id);
          roomsToEmit.add(`conv-${custByEmail.id}`);
          if (custByEmail.user?.id) {
            roomsToEmit.add(custByEmail.user.id);
            roomsToEmit.add(`conv-${custByEmail.user.id}`);
          }
        }
      }

      roomsToEmit.forEach((room) => {
        this.server.to(room).emit('new-message-received', payload);
      });

      // 2. Broadcast to all admin role rooms
      this.server.to('role::admin').to('role::super-admin').to('admin-room').emit('new-message-received', payload);

      // 3. Direct target emission
      if (payload.senderId) {
        this.server.to(payload.senderId).emit('new-message-received', payload);
        this.server.to(`conv-${payload.senderId}`).emit('new-message-received', payload);
      }
      if (payload.guestId) {
        this.server.to(payload.guestId).emit('new-message-received', payload);
        this.server.to(`conv-${payload.guestId}`).emit('new-message-received', payload);
      }

      // 4. Persist Message & Conversation in Prisma Database
      try {
        const canonicalConvId = linkedCustomer?.id
          ? `conv-${linkedCustomer.id}`
          : (linkedUser?.customerId ? `conv-${linkedUser.customerId}` : prefConvId);

        let validSenderUser: any = null;

        if (payload.isAdmin) {
          validSenderUser = await this.prisma.user.findFirst({
            where: { id: payload.senderId, role: 'admin', isDeleted: false },
          });
        } else {
          validSenderUser = await this.prisma.user.findFirst({
            where: {
              isDeleted: false,
              role: { not: 'admin' },
              OR: [
                { id: payload.senderId },
                { customerId: payload.senderId },
                { customerId: rawConvId },
              ],
            },
          });
          if (!validSenderUser) {
            validSenderUser = await this.prisma.user.findFirst({
              where: {
                isDeleted: false,
                OR: [
                  { id: payload.senderId },
                  { customerId: payload.senderId },
                  { customerId: rawConvId },
                ],
              },
            });
          }
          if (!validSenderUser) {
            validSenderUser = await this.prisma.user.findFirst({
              where: { role: 'user', isDeleted: false },
            });
          }
          if (!validSenderUser) {
            try {
              validSenderUser = await this.prisma.user.upsert({
                where: { id: 'system_guest_chat_user' },
                update: {},
                create: {
                  id: 'system_guest_chat_user',
                  name: 'Guest Visitor',
                  email: 'guest@ferio.local',
                  role: 'user',
                  isDeleted: false,
                },
              });
            } catch {
              validSenderUser = await this.prisma.user.findFirst({ where: { isDeleted: false } });
            }
          }
        }

        if (validSenderUser) {
          let conversation = await this.prisma.conversation.findFirst({
            where: {
              isDeleted: false,
              id: { in: [targetConvId, rawConvId, prefConvId] },
            },
          });

          if (!conversation) {
            conversation = await this.prisma.conversation.create({
              data: {
                id: canonicalConvId,
                creatorId: validSenderUser.id,
                type: 'direct',
                lastMessageText: payload.text,
                lastMessageCreatedAt: new Date(payload.createdAt),
              },
            });
          } else {
            await this.prisma.conversation.update({
              where: { id: conversation.id },
              data: {
                lastMessageText: payload.text,
                lastMessageCreatedAt: new Date(payload.createdAt),
              },
            });
          }

          // Check if message was already created to prevent duplicates
          const existingMsg = await this.prisma.message.findUnique({
            where: { id: payload._messageId },
          });

          if (!existingMsg) {
            await this.prisma.message.create({
              data: {
                id: payload._messageId,
                text: payload.text,
                senderId: validSenderUser.id,
                conversationId: conversation.id,
                createdAt: new Date(payload.createdAt),
              },
            });
            this.logger.log(`💾 Persisted message [${payload._messageId}] to DB in conversation [${conversation.id}]`);
          }
        }
      } catch (dbErr: any) {
        this.logger.warn(`⚠️ Could not persist chat message to DB: ${dbErr.message}`);
      }

      return { success: true, data: payload };
    } catch (error: any) {
      this.logger.error(`❌ handleNewMessage error: ${error.message}`);
      return { success: false, message: 'Failed to process message' };
    }
  }

  @SubscribeMessage('send-message')
  async handleSendMessageAlias(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: any,
  ) {
    return this.handleNewMessage(client, data);
  }

  /**
   * Join Task Room
   */
  @SubscribeMessage('join-task')
  async handleJoinTaskRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { taskId: string },
  ) {
    try {
      const userId = client.data.userId;
      const { taskId } = data;

      if (!taskId) {
        return { success: false, message: 'taskId is required' };
      }

      // Join Socket.IO room
      client.join(taskId);

      // Update Redis state
      await this.socketRoomService.joinTaskRoom(userId, taskId);

      // Get task room users
      const roomUsers = await this.socketRoomService.getTaskRoomUsers(taskId);

      this.logger.log(
        `📋 Task room ${taskId} has ${roomUsers.length} users`,
      );

      // Notify others in the task
      client.to(taskId).emit('user-joined-task', {
        userId,
        userName: client.data.user?.name,
        taskId,
        isOnline: true,
      });

      return { success: true, message: 'Joined task room successfully' };
    } catch (error) {
      this.logger.error(`❌ Join task room error: ${error.message}`);
      return { success: false, message: 'Failed to join task room' };
    }
  }

  /**
   * Leave Task Room
   */
  @SubscribeMessage('leave-task')
  async handleLeaveTaskRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { taskId: string },
  ) {
    try {
      const userId = client.data.userId;
      const { taskId } = data;

      if (!taskId) {
        return { success: false, message: 'taskId is required' };
      }

      // Leave Socket.IO room
      client.leave(taskId);

      // Update Redis state
      await this.socketRoomService.leaveTaskRoom(userId, taskId);

      // Notify others
      client.to(taskId).emit('user-left-task', {
        userId,
        userName: client.data.user?.name,
        taskId,
      });

      return { success: true, message: 'Left task room successfully' };
    } catch (error) {
      this.logger.error(`❌ Leave task room error: ${error.message}`);
      return { success: false, message: 'Failed to leave task room' };
    }
  }

  /**
   * Get Related Online Users
   */
  @SubscribeMessage('only-related-online-users')
  async handleGetRelatedOnlineUsers(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId: string },
  ) {
    try {
      const relatedOnlineUsers = await this.socketAuthService.getRelatedOnlineUsers(
        data.userId,
      );

      this.logger.log(
        `📊 Related online users for ${data.userId}: ${relatedOnlineUsers.length}`,
      );

      return {
        success: true,
        data: relatedOnlineUsers,
      };
    } catch (error) {
      this.logger.error(`❌ Get related online users error: ${error.message}`);
      return {
        success: false,
        message: 'Failed to fetch related online users',
      };
    }
  }

  /**
   * Get Family Activity Feed
   */
  @SubscribeMessage('get-family-activity-feed')
  async handleGetFamilyActivityFeed(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { businessUserId: string; limit?: number },
  ) {
    try {
      const limit = data.limit || 10;
      const activities = await this.socketRoomService.getActivityFeed(
        data.businessUserId,
        limit,
      );

      return {
        success: true,
        data: activities,
      };
    } catch (error) {
      this.logger.error(`❌ Get family activity feed error: ${error.message}`);
      return {
        success: false,
        message: 'Failed to fetch activity feed',
      };
    }
  }

  // ────────────────────────────────────────────────────────────────────────
  // NOTIFICATION EMISSION METHODS
  // Called from NotificationService to emit real-time notifications
  // ────────────────────────────────────────────────────────────────────────

  /**
   * Emit Notification to User
   * 
   * @param userId - User ID
   * @param notification - Notification data
   */
  async emitNotificationToUser(userId: string, notification: any): Promise<boolean> {
    try {
      const eventName = `notification::${userId}`;
      
      this.server.to(userId).emit(eventName, notification);
      
      this.logger.log(`🔔 Notification sent to user ${userId}`);
      
      return true;
    } catch (error) {
      this.logger.error(`❌ Failed to emit notification: ${error.message}`);
      return false;
    }
  }

  /**
   * Emit Unread Count Update to User
   * 
   * @param userId - User ID
   * @param count - Unread count
   */
  async emitUnreadCountUpdate(userId: string, count: number): Promise<void> {
    try {
      const eventName = `notification:unread-count::${userId}`;
      
      this.server.to(userId).emit(eventName, { count, hasUnread: count > 0 });
      
      this.logger.debug(`📊 Unread count update sent to user ${userId}: ${count}`);
    } catch (error) {
      this.logger.error(`❌ Failed to emit unread count: ${error.message}`);
    }
  }

  /**
   * Broadcast to Role
   * 
   * @param role - Role name
   * @param event - Event name
   * @param data - Data to emit
   */
  async broadcastToRole(role: string, event: string, data: any): Promise<void> {
    try {
      const roomName = `role::${role}`;
      
      this.server.to(roomName).emit(event, data);
      
      this.logger.log(`📢 Broadcast to role ${role}: ${event}`);
    } catch (error) {
      this.logger.error(`❌ Failed to broadcast to role: ${error.message}`);
    }
  }

  /**
   * Check if User is Online
   * 
   * @param userId - User ID
   */
  async isUserOnline(userId: string): Promise<boolean> {
    const sockets = await this.server.in(userId).fetchSockets();
    return sockets.length > 0;
  }

  /**
   * Emit to User
   * 
   * @param userId - User ID
   * @param event - Event name
   * @param data - Data to emit
   */
  async emitToUser(userId: string, event: string, data: any): Promise<boolean> {
    try {
      const isOnline = await this.isUserOnline(userId);
      if (isOnline) {
        this.server.to(userId).emit(event, data);
        this.logger.log(`🔔 Emitted to online user ${userId}`);
        return true;
      }

      // Offline: push notification
      const user: any = await this.socketAuthService.getUserProfile(userId);
      if (user?.fcmToken) {
        await this.firebaseService.sendPushNotification(
          user.fcmToken,
          data.title || 'New Notification',
          data.message || 'You have a new message',
          data,
        );
        this.logger.log(`📱 Push notification sent to offline user ${userId}`);
        return true;
      }

      return false;
    } catch (error) {
      this.logger.error(`❌ Failed to emit to user: ${error.message}`);
      return false;
    }
  }

  /**
   * Emit to Room
   *
   * @param roomId - Room ID
   * @param event - Event name
   * @param data - Data to emit
   */
  async emitToRoom(roomId: string, event: string, data: any): Promise<boolean> {
    try {
      this.server.to(roomId).emit(event, data);
      return true;
    } catch (error) {
      this.logger.error(`❌ Failed to emit to room: ${error.message}`);
      return false;
    }
  }

  /**
   * Check if member is in room
   *
   * @param userId - User ID
   * @param roomId - Room ID
   */
  async isMemberInRoom(userId: string, roomId: string): Promise<boolean> {
    try {
      return await this.socketRoomService.isUserInRoom(userId, roomId);
    } catch (error) {
      this.logger.error(`❌ Failed to check if member is in room: ${error.message}`);
      return false;
    }
  }
}
