import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum, IsNotEmpty } from 'class-validator';
import { AttachmentType } from '../attachment.schema';

/**
 * Create Attachment DTO
 */
export class CreateAttachmentDto {
  @ApiPropertyOptional({ description: 'Entity type this attachment is attached to' })
  @IsString()
  @IsOptional()
  attachedToType?: string;

  @ApiPropertyOptional({ description: 'Entity ID this attachment is attached to' })
  @IsString()
  @IsOptional()
  attachedToId?: string;
}

/**
 * Update Attachment DTO
 */
export class UpdateAttachmentDto {
  @ApiPropertyOptional({ description: 'Entity type this attachment is attached to' })
  @IsString()
  @IsOptional()
  attachedToType?: string;

  @ApiPropertyOptional({ description: 'Entity ID this attachment is attached to' })
  @IsString()
  @IsOptional()
  attachedToId?: string;
}

/**
 * Get Attachments by Entity Query DTO
 */
export class GetAttachmentsByEntityDto {
  @ApiProperty({ description: 'Entity type (task, user, message, etc.)' })
  @IsString()
  @IsNotEmpty()
  attachedToType: string;

  @ApiProperty({ description: 'Entity ID' })
  @IsString()
  @IsNotEmpty()
  attachedToId: string;
}
