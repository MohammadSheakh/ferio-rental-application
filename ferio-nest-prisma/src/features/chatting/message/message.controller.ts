import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Query,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery, ApiParam } from '@nestjs/swagger';

import { MessageService } from './message.service';
import { SendMessageDto, GetMessagesQueryDto, UpdateMessageDto, DeleteMessageDto } from './dto/message.dto';
import { AuthGuard, User } from '@app/common';
import type { UserPayload } from '@app/common';

/**
 * Message Controller
 *
 * 📚 MESSAGE MANAGEMENT API
 *
 * Endpoints:
 * - GET /conversations/:conversationId/messages - Get messages
 * - POST /conversations/:conversationId/messages - Send message
 * - PUT /messages/:messageId - Update message
 * - DELETE /messages/:messageId - Delete message
 * - GET /messages/:messageId/unread-count - Get unread count
 *
 * Compatible with Express.js message.controller.ts
 */
@ApiTags('Messages')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('conversations')
export class MessageController {
  private readonly logger = new Logger(MessageController.name);

  constructor(private readonly messageService: MessageService) {}

  @Get(':conversationId/messages')
  @ApiOperation({ summary: 'Get messages in a conversation' })
  @ApiParam({ name: 'conversationId', description: 'Conversation ID' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiResponse({ status: 200, description: 'Messages retrieved successfully' })
  async getMessages(
    @Param('conversationId') conversationId: string,
    @Query() query: GetMessagesQueryDto,
    @User() user: UserPayload,
  ) {
    this.logger.log(`📬 Getting messages for conversation ${conversationId}`);

    const { page = 1, limit = 20 } = query;

    const result = await this.messageService.getMessagesByConversation(
      conversationId,
      user.userId,
      page,
      limit,
      user.role,
    );

    return {
      success: true,
      message: 'Messages retrieved successfully',
      data: result,
    };
  }

  @Get(':conversationId/messages/cursor')
  @ApiOperation({ summary: 'Get messages with cursor pagination (more efficient)' })
  @ApiParam({ name: 'conversationId', description: 'Conversation ID' })
  @ApiQuery({ name: 'before', required: false, type: String, description: 'Message ID' })
  @ApiQuery({ name: 'after', required: false, type: String, description: 'Message ID' })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiResponse({ status: 200, description: 'Messages retrieved successfully' })
  async getMessagesWithCursor(
    @Param('conversationId') conversationId: string,
    @User() user: UserPayload,
    @Query('before') before?: string,
    @Query('after') after?: string,
    @Query('limit') limit: number = 20,
  ) {
    this.logger.log(`📬 Getting messages with cursor for conversation ${conversationId}`);

    const result = await this.messageService.getMessagesWithCursor(conversationId, user.userId, {
      before,
      after,
      limit,
    }, user.role);

    return {
      success: true,
      message: 'Messages retrieved successfully',
      data: result,
    };
  }

  @Post(':conversationId/messages')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Send a message in a conversation' })
  @ApiParam({ name: 'conversationId', description: 'Conversation ID' })
  @ApiResponse({ status: 201, description: 'Message sent successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  async sendMessage(
    @Param('conversationId') conversationId: string,
    @Body() sendMessageDto: SendMessageDto,
    @User('userId') userId: string,
  ) {
    this.logger.log(`📝 Sending message in conversation ${conversationId} by user ${userId}`);

    const message = await this.messageService.sendMessage(
      conversationId,
      userId,
      sendMessageDto,
    );

    return {
      success: true,
      message: 'Message sent successfully',
      data: message,
    };
  }

  @Put('messages/:messageId')
  @ApiOperation({ summary: 'Update a message' })
  @ApiParam({ name: 'messageId', description: 'Message ID' })
  @ApiResponse({ status: 200, description: 'Message updated successfully' })
  @ApiResponse({ status: 404, description: 'Message not found' })
  async updateMessage(
    @Param('messageId') messageId: string,
    @Body() updateDto: UpdateMessageDto,
    @User('userId') userId: string,
  ) {
    this.logger.log(`✏️ Updating message ${messageId} by user ${userId}`);

    const message = await this.messageService.updateMessage(
      messageId,
      userId,
      updateDto.text,
    );

    return {
      success: true,
      message: 'Message updated successfully',
      data: message,
    };
  }

  @Delete('messages/:messageId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a message' })
  @ApiParam({ name: 'messageId', description: 'Message ID' })
  @ApiResponse({ status: 200, description: 'Message deleted successfully' })
  @ApiResponse({ status: 404, description: 'Message not found' })
  async deleteMessage(
    @Param('messageId') messageId: string,
    @User('userId') userId: string,
  ) {
    this.logger.log(`🗑️ Deleting message ${messageId} by user ${userId}`);

    await this.messageService.deleteMessage(messageId, userId);

    return {
      success: true,
      message: 'Message deleted successfully',
      data: null,
    };
  }

  @Get('messages/:messageId/unread-count')
  @ApiOperation({ summary: 'Get unread message count for a conversation' })
  @ApiParam({ name: 'messageId', description: 'Message ID (to get conversation)' })
  @ApiQuery({ name: 'conversationId', required: true, type: String })
  @ApiResponse({ status: 200, description: 'Unread count retrieved successfully' })
  async getUnreadCount(
    @Query('conversationId') conversationId: string,
    @User('userId') userId: string,
  ) {
    this.logger.log(`📊 Getting unread count for conversation ${conversationId}`);

    const count = await this.messageService.getUnreadCount(userId, conversationId);

    return {
      success: true,
      message: 'Unread count retrieved successfully',
      data: {
        conversationId,
        unreadCount: count,
      },
    };
  }
}
