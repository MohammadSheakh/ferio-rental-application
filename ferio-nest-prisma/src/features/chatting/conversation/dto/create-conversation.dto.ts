import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsArray } from 'class-validator';

/**
 * Create Conversation DTO
 *
 * 📚 CREATE CONVERSATION REQUEST
 */
export class CreateConversationDto {
  @ApiProperty({
    description: 'Participant user IDs',
    example: ['userId1', 'userId2'],
    required: true,
  })
  @IsArray()
  @IsNotEmpty({ each: true })
  participants: string[];

  @ApiProperty({
    description: 'Initial message (optional)',
    example: 'Hello!',
    required: false,
  })
  @IsOptional()
  @IsString()
  message?: string;

  @ApiProperty({
    description: 'Group name (for group conversations)',
    example: 'Family Group',
    required: false,
  })
  @IsOptional()
  @IsString()
  groupName?: string;

  @ApiProperty({
    description: 'Group profile picture URL (for group conversations)',
    example: 'https://example.com/image.jpg',
    required: false,
  })
  @IsOptional()
  @IsString()
  groupProfilePicture?: string;
}

/**
 * Add Participants DTO
 */
export class AddParticipantsDto {
  @ApiProperty({
    description: 'Participant user IDs to add',
    example: ['userId1', 'userId2'],
    required: true,
  })
  @IsArray()
  @IsNotEmpty({ each: true })
  participants: string[];

  @ApiProperty({
    description: 'Conversation ID',
    example: '507f1f77bcf86cd799439011',
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  conversationId: string;
}

/**
 * Remove Participant DTO
 */
export class RemoveParticipantDto {
  @ApiProperty({
    description: 'Conversation ID',
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  conversationId: string;

  @ApiProperty({
    description: 'Participant user ID to remove',
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  participantId: string;
}

/**
 * Get Conversations Query DTO
 */
export class GetConversationsQueryDto {
  @ApiProperty({
    description: 'Page number',
    example: 1,
    required: false,
  })
  @IsOptional()
  page?: number = 1;

  @ApiProperty({
    description: 'Items per page',
    example: 10,
    required: false,
  })
  @IsOptional()
  limit?: number = 10;

  @ApiProperty({
    description: 'Search query',
    example: 'John',
    required: false,
  })
  @IsOptional()
  @IsString()
  search?: string = '';
}
