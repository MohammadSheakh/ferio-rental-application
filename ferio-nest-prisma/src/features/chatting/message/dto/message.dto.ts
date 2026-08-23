import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsArray, IsOptional } from 'class-validator';

/**
 * Send Message DTO
 *
 * 📚 SEND MESSAGE REQUEST
 *
 * Compatible with Express.js message.controller.ts
 */
export class SendMessageDto {
  @ApiProperty({
    description: 'Message text',
    example: 'Hello, how are you?',
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  text: string;

  @ApiProperty({
    description: 'Attachment IDs (optional)',
    example: ['attachmentId1', 'attachmentId2'],
    required: false,
  })
  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  attachments?: string[];
}

/**
 * Get Messages Query DTO
 */
export class GetMessagesQueryDto {
  @ApiProperty({
    description: 'Page number',
    example: 1,
    required: false,
  })
  @IsOptional()
  page?: number = 1;

  @ApiProperty({
    description: 'Items per page',
    example: 20,
    required: false,
  })
  @IsOptional()
  limit?: number = 20;

  @ApiProperty({
    description: 'Before cursor (message ID for pagination)',
    example: '507f1f77bcf86cd799439011',
    required: false,
  })
  @IsOptional()
  @IsString()
  before?: string;

  @ApiProperty({
    description: 'After cursor (message ID for pagination)',
    example: '507f1f77bcf86cd799439011',
    required: false,
  })
  @IsOptional()
  @IsString()
  after?: string;
}

/**
 * Update Message DTO
 */
export class UpdateMessageDto {
  @ApiProperty({
    description: 'Updated message text',
    example: 'Updated message text',
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  text: string;
}

/**
 * Delete Message DTO
 */
export class DeleteMessageDto {
  @ApiProperty({
    description: 'Message ID to delete',
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  messageId: string;
}
