import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';

import { ConversationService } from './conversation.service';
import {
  CreateConversationDto,
  AddParticipantsDto,
  RemoveParticipantDto,
  GetConversationsQueryDto,
} from './dto/create-conversation.dto';
import {
  AuthGuard,
  PERMISSIONS,
  Permissions,
  PermissionsGuard,
  Roles,
  RolesGuard,
  StructuredLogger,
  User,
} from '@app/common';

/**
 * Conversation Controller
 *
 * 📚 CONVERSATION MANAGEMENT API
 *
 * Endpoints:
 * - POST /conversations - Create conversation
 * - GET /conversations/all - Get all conversations (Admin)
 * - GET /conversations/my - Get my conversations
 * - POST /conversations/participants/add - Add participants
 * - POST /conversations/participants/remove - Remove participant
 * - GET /conversations/participants - Get participants
 * - POST /conversations/:id/read - Mark as read
 *
 * Compatible with Express.js conversation.controller.ts
 */
@ApiTags('Conversations')
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard, PermissionsGuard)
@Controller('conversations')
export class ConversationController {
  private readonly logger = new StructuredLogger(ConversationController.name);

  constructor(private readonly conversationService: ConversationService) {}

  @Get('all')
  @Roles('admin')
  @Permissions(PERMISSIONS.CHAT_READ)
  @ApiOperation({ summary: 'Get all conversations for admin dashboard' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 50 })
  @ApiResponse({
    status: 200,
    description: 'All conversations retrieved successfully',
  })
  async getAllConversations(@Query() query: GetConversationsQueryDto) {
    this.logger.log('admin_conversations_requested');
    const { page = 1, limit = 50 } = query;
    const result = await this.conversationService.getAllConversations(
      page,
      limit,
    );
    return {
      success: true,
      message: 'All conversations retrieved successfully',
      data: result,
    };
  }

  @Post()
  @ApiOperation({ summary: 'Create a new conversation' })
  @ApiResponse({
    status: 201,
    description: 'Conversation created successfully',
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async createConversation(
    @Body() createDto: CreateConversationDto,
    @User('userId') userId: string,
  ) {
    this.logger.log('conversation_create_requested', { userId });

    const result = await this.conversationService.createConversation(
      createDto,
      userId,
    );

    return {
      success: true,
      message: result.created
        ? 'Conversation created successfully'
        : 'Conversation already exists',
      data: result.conversation,
    };
  }

  @Get('my')
  @ApiOperation({ summary: 'Get my conversations with pagination' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiQuery({ name: 'search', required: false, type: String, example: '' })
  @ApiResponse({
    status: 200,
    description: 'Conversations retrieved successfully',
  })
  async getMyConversations(
    @Query() query: GetConversationsQueryDto,
    @User('userId') userId: string,
  ) {
    this.logger.log('user_conversations_requested', { userId });

    const { page = 1, limit = 10, search = '' } = query;

    const result = await this.conversationService.getConversationsByUserId(
      userId,
      page,
      limit,
      search,
    );

    return {
      success: true,
      message: 'Conversations retrieved successfully',
      data: result,
    };
  }

  @Post('participants/add')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Add participants to existing conversation' })
  @ApiResponse({ status: 200, description: 'Participants added successfully' })
  async addParticipants(
    @Body() addDto: AddParticipantsDto,
    @User('userId') userId: string,
  ) {
    this.logger.log('conversation_participants_add_requested', {
      userId,
      conversationId: addDto.conversationId,
      participantCount: addDto.participants.length,
    });

    const { participants, conversationId } = addDto;

    await this.conversationService.addParticipantsToConversation(
      conversationId,
      participants,
      userId,
      true,
    );

    return {
      success: true,
      message: `Participants added successfully to conversation ${conversationId}`,
      data: null,
    };
  }

  @Post('participants/remove')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove participant from conversation' })
  @ApiResponse({ status: 200, description: 'Participant removed successfully' })
  async removeParticipant(
    @Body() removeDto: RemoveParticipantDto,
    @User('userId') userId: string,
  ) {
    this.logger.log('conversation_participant_remove_requested', {
      userId,
      conversationId: removeDto.conversationId,
    });

    const { conversationId, participantId } = removeDto;

    await this.conversationService.removeParticipant(
      conversationId,
      participantId,
      userId,
    );

    return {
      success: true,
      message: `Participant removed successfully from conversation ${conversationId}`,
      data: null,
    };
  }

  @Get('participants')
  @ApiOperation({ summary: 'Get participants in a conversation' })
  @ApiQuery({ name: 'conversationId', required: true, type: String })
  @ApiResponse({
    status: 200,
    description: 'Participants retrieved successfully',
  })
  async getParticipants(
    @Query('conversationId') conversationId: string,
    @User('userId') userId: string,
  ) {
    this.logger.log('conversation_participants_requested', {
      userId,
      conversationId,
    });

    // TODO: Implement getParticipants method in service
    // For now, return placeholder
    return {
      success: true,
      message: 'Participants retrieved successfully',
      data: [],
    };
  }

  @Post(':conversationId/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark conversation as read' })
  @ApiResponse({ status: 200, description: 'Conversation marked as read' })
  async markAsRead(
    @Param('conversationId') conversationId: string,
    @User('userId') userId: string,
  ) {
    this.logger.log('conversation_mark_read_requested', {
      userId,
      conversationId,
    });

    await this.conversationService.markAsRead(userId, conversationId);

    return {
      success: true,
      message: 'Conversation marked as read',
      data: null,
    };
  }
}
