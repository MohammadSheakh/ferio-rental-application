import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';

import { NotificationService } from './notification.service';
import { SendNotificationDto, BroadcastNotificationDto } from './dto/notification.dto';
import { AuthGuard, UserPayload, User, TransformResponseInterceptor } from '@app/common';

/**
 * Notification Controller
 * 
 * 📚 GENERIC NOTIFICATION SYSTEM
 * 
 * Endpoints:
 * - GET /notifications - Get user's notifications
 * - GET /notifications/unread/count - Get unread count
 * - POST /notifications/:id/read - Mark as read
 * - POST /notifications/read-all - Mark all as read
 * - DELETE /notifications/:id - Delete notification
 * - POST /notifications/broadcast - Broadcast notification (admin only)
 */
@ApiTags('Notifications')
@Controller('notifications')
@UseGuards(AuthGuard)
@UseInterceptors(TransformResponseInterceptor)
@ApiBearerAuth()
export class NotificationController {
  constructor(private notificationService: NotificationService) {}

  /**
   * GET /notifications/types
   * Get all available notification types
   */
  @Get('types')
  @ApiOperation({ summary: 'Get all notification types' })
  @ApiResponse({ status: 200, description: 'Notification types retrieved successfully' })
  async getNotificationTypes() {
    return { types: this.notificationService.getAllNotificationTypes() };
  }

  /**
   * GET /notifications
   * Get user's notifications with pagination
   */
  @Get()
  @ApiOperation({ summary: 'Get my notifications' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'isRead', required: false, type: Boolean, example: false })
  @ApiResponse({ status: 200, description: 'Notifications retrieved successfully' })
  async getNotifications(
    @User() user: UserPayload,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('isRead') isRead?: boolean,
  ) {
    const result = await this.notificationService.getUserNotifications(
      user.userId,
      page,
      limit,
      isRead,
    );

    return {
      notifications: result.notifications,
      pagination: {
        page: page || 1,
        limit: limit || 20,
        total: result.total,
        totalPages: Math.ceil(result.total / (limit || 20)),
      },
    };
  }

  /**
   * GET /notifications/unread/count
   * Get unread notification count
   */
  @Get('unread/count')
  @ApiOperation({ summary: 'Get unread count' })
  @ApiResponse({ status: 200, description: 'Unread count retrieved successfully' })
  async getUnreadCount(@User() user: UserPayload) {
    const count = await this.notificationService.getUnreadCount(user.userId);
    return { count, hasUnread: count > 0 };
  }

  /**
   * POST /notifications/:id/read
   * Mark notification as read
   */
  @Post(':id/read')
  @ApiOperation({ summary: 'Mark notification as read' })
  @ApiResponse({ status: 200, description: 'Notification marked as read' })
  async markAsRead(
    @User() user: UserPayload,
    @Param('id') notificationId: string,
  ) {
    const notification = await this.notificationService.markAsRead(
      notificationId,
      user.userId,
    );

    return {
      message: 'Notification marked as read',
      notification,
    };
  }

  /**
   * POST /notifications/read-all
   * Mark all notifications as read
   */
  @Post('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  @ApiResponse({ status: 200, description: 'All notifications marked as read' })
  async markAllAsRead(@User() user: UserPayload) {
    const result = await this.notificationService.markAllAsRead(user.userId);

    return {
      message: 'All notifications marked as read',
      modifiedCount: result.modifiedCount,
    };
  }

  /**
   * DELETE /notifications/:id
   * Delete notification
   */
  @Delete(':id')
  @ApiOperation({ summary: 'Delete notification' })
  @ApiResponse({ status: 200, description: 'Notification deleted successfully' })
  async deleteNotification(
    @User() user: UserPayload,
    @Param('id') notificationId: string,
  ) {
    await this.notificationService.deleteNotification(notificationId, user.userId);

    return { message: 'Notification deleted successfully' };
  }

  /**
   * POST /notifications/broadcast
   * Broadcast notification to multiple users (admin only)
   */
  @Post('broadcast')
  @ApiOperation({ summary: 'Broadcast notification' })
  @ApiResponse({ status: 200, description: 'Notification broadcasted successfully' })
  async broadcastNotification(
    @User() user: UserPayload,
    @Body() broadcastDto: BroadcastNotificationDto,
  ) {
    // TODO: Add admin role guard
    await this.notificationService.broadcastNotification(broadcastDto);

    return { message: 'Notification broadcasted successfully' };
  }

  /**
   * POST /notifications/send
   * Send notification (generic endpoint for any module)
   */
  @Post('send')
  @ApiOperation({ summary: 'Send notification' })
  @ApiResponse({ status: 200, description: 'Notification sent successfully' })
  async sendNotification(@Body() sendDto: SendNotificationDto) {
    const notification = await this.notificationService.sendNotification(sendDto);

    return {
      message: 'Notification sent successfully',
      notification,
    };
  }

  /**
   * POST /notifications/enqueue
   * Enqueue notification for async processing
   */
  @Post('enqueue')
  @ApiOperation({ summary: 'Enqueue notification for async processing' })
  @ApiResponse({ status: 200, description: 'Notification enqueued successfully' })
  async enqueueNotification(@Body() enqueueDto: SendNotificationDto) {
    await this.notificationService.enqueueNotification(enqueueDto);

    return { message: 'Notification enqueued successfully' };
  }
}
