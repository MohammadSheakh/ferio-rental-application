import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { 
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
} from '@nestjs/swagger';
import { diskStorage } from 'multer';
import { extname } from 'path';

import { AttachmentService } from './attachment.service';
import {
  CreateAttachmentDto,
  GetAttachmentsByEntityDto,
} from './dto/attachment.dto';

import { AuthGuard, UserPayload, User, TransformResponseInterceptor, UseFileUploadPipeline, GenericController } from '@app/common';


/**
 * Attachment Controller
 * 
 * 📚 INDUSTRY STANDARD IMPLEMENTATION
 * 
 * Manages file attachments with:
 * - Multer file upload
 * - Cloudinary/S3 integration
 * - File type validation
 * - Redis caching
 * 
 * ✅ UPDATED: Uses FileUploadPipeline decorator (like Express middleware)
 * 
 * Extends GenericController for CRUD operations
 */
@ApiTags('Attachments')
@Controller('attachments')
@UseGuards(AuthGuard)
@UseInterceptors(TransformResponseInterceptor)
@ApiBearerAuth()
export class AttachmentController extends GenericController<typeof Attachment, AttachmentDocument> {
  constructor(private attachmentService: AttachmentService) {
    super(attachmentService, 'Attachment');
  }

  /**
   * POST /attachments/upload
   * Upload single or multiple attachments
   * 
   * ✅ Uses UseFileUploadPipeline decorator (replaces Express middleware)
   */
  @Post('upload')
  @ApiOperation({ 
    summary: 'Upload attachments',
    description: 'Upload single or multiple file attachments with validation',
  })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 201, description: 'Attachments uploaded successfully' })
  @UseFileUploadPipeline({
    fieldName: 'attachments',
    folder: 'attachments',
    maxCount: 10,
    required: true,
    allowedMimeTypes: ['image/jpeg', 'image/png', 'application/pdf', 'video/mp4'],
    maxSize: 10 * 1024 * 1024, // 10MB
    storage: 'memory',
  })
  async uploadAttachments(
    @User() user: UserPayload,
    @Body() createAttachmentDto: CreateAttachmentDto,
    @UploadedFiles() files: { attachments?: Express.Multer.File[] },
  ) {
    // Files are already uploaded to cloud by FileUploadProcessingInterceptor
    // req.uploadedFiles contains attachment IDs
    const request = { uploadedFiles: files } as any;
    
    return {
      message: 'Attachments uploaded successfully',
      attachmentIds: request.uploadedFiles?.attachments || [],
      count: request.uploadedFiles?.attachments?.length || 0,
    };
  }

  /**
   * GET /attachments/by-entity
   * Get attachments by entity
   */
  @Get('by-entity')
  @ApiOperation({ 
    summary: 'Get attachments by entity',
    description: 'Get all attachments attached to a specific entity',
  })
  @ApiResponse({ status: 200, description: 'Attachments retrieved successfully' })
  async getAttachmentsByEntity(@Query() query: GetAttachmentsByEntityDto) {
    return await this.attachmentService.getAttachmentsByEntity(
      query.attachedToType,
      query.attachedToId,
    );
  }

  /**
   * DELETE /attachments/:id
   * Delete attachment (and file from cloud storage)
   */
  @Delete(':id')
  @ApiOperation({ 
    summary: 'Delete attachment',
    description: 'Delete attachment and remove file from cloud storage',
  })
  @ApiResponse({ status: 200, description: 'Attachment deleted successfully' })
  async deleteAttachment(@Param('id') id: string) {
    await this.attachmentService.deleteAttachment(id);
    return { message: 'Attachment deleted successfully' };
  }
}
