import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Redis } from 'ioredis';

import { GenericService } from '@app/common';
import { Attachment, AttachmentDocument, AttachmentType } from './attachment.schema';
import { REDIS_CLIENT } from '@app/redis';
import { IFileUploadStrategy } from './strategies/file-upload.strategy.interface';

/**
 * File Upload Result
 */
export interface FileUploadResult {
  url: string;
  publicId?: string;
}

/**
 * Attachment Service
 * 
 * 📚 STRATEGY PATTERN IMPLEMENTATION
 * 
 * Manages file attachments with:
 * - Pluggable file upload strategies (Cloudinary, S3, DigitalOcean)
 * - File type detection
 * - Redis caching
 * - Soft delete support
 * 
 * Extends GenericService for CRUD operations
 */
@Injectable()
export class AttachmentService extends GenericService<typeof Attachment, AttachmentDocument> {
  private readonly ATTACHMENT_CACHE_PREFIX = 'attachment:';
  private readonly ATTACHMENT_CACHE_TTL = 300; // 5 minutes

  constructor(
    @InjectModel(Attachment.name) attachmentModel: Model<AttachmentDocument>,
    @Inject(REDIS_CLIENT) private redisClient: Redis,
    @Inject('FILE_UPLOAD_STRATEGY') private uploadStrategy: IFileUploadStrategy,
  ) {
    super(attachmentModel);
  }

  /**
   * Upload single attachment
   * 
   * @param file - Uploaded file from multer
   * @param folder - Cloud storage folder name
   * @param uploadedByUserId - User who uploaded
   * @param attachedToId - Entity ID this is attached to
   * @param attachedToType - Entity type this is attached to
   * @returns Created attachment ID
   */
  async uploadSingleAttachment(
    file: Express.Multer.File,
    folder: string,
    uploadedByUserId?: string,
    attachedToId?: string,
    attachedToType?: string,
  ): Promise<string> {
    // Upload to cloud storage using strategy
    const uploadResult = await this.uploadStrategy.uploadFile(file, folder);

    // Detect file type
    const fileType = this.detectFileType(file);

    // Create attachment record
    const attachment = await this.create({
      attachment: uploadResult.url,
      attachmentType: fileType,
      publicId: uploadResult.publicId,
      originalName: file.originalname,
      size: file.size,
      mimeType: file.mimetype,
      uploadedByUserId: uploadedByUserId ? new Types.ObjectId(uploadedByUserId) : undefined,
      attachedToId: attachedToId ? new Types.ObjectId(attachedToId) : undefined,
      attachedToType,
    });

    return attachment._id.toString();
  }

  /**
   * Upload multiple attachments
   * 
   * @param files - Array of uploaded files
   * @param folder - Cloud storage folder name
   * @param uploadedByUserId - User who uploaded
   * @returns Array of attachment IDs
   */
  async uploadMultipleAttachments(
    files: Express.Multer.File[],
    folder: string,
    uploadedByUserId?: string,
  ): Promise<string[]> {
    const attachmentIds = await Promise.all(
      files.map(file => this.uploadSingleAttachment(file, folder, uploadedByUserId)),
    );

    return attachmentIds;
  }

  /**
   * Delete attachment (and file from cloud storage)
   * 
   * @param attachmentId - Attachment ID to delete
   */
  async deleteAttachment(attachmentId: string): Promise<void> {
    const attachment = await this.findById(attachmentId);

    if (!attachment) {
      throw new NotFoundException('Attachment not found');
    }

    // Delete file from cloud storage using strategy
    if (attachment.publicId) {
      await this.uploadStrategy.deleteFile(attachment.publicId);
    }

    // Soft delete
    await this.softDeleteById(attachmentId);

    // Invalidate cache
    await this.invalidateCache(attachmentId);
  }

  /**
   * Get attachments by entity
   * 
   * @param attachedToType - Entity type (task, user, message, etc.)
   * @param attachedToId - Entity ID
   * @returns Array of attachments
   */
  async getAttachmentsByEntity(
    attachedToType: string,
    attachedToId: string,
  ): Promise<AttachmentDocument[]> {
    return this.findAll({
      attachedToType,
      attachedToId: new Types.ObjectId(attachedToId),
      isDeleted: false,
    });
  }

  /**
   * Detect file type from MIME type
   */
  private detectFileType(file: Express.Multer.File): AttachmentType {
    const videoMimeTypes = [
      'video/mp4',
      'video/mpeg',
      'video/quicktime',
      'video/x-msvideo',
      'video/webm',
      'video/x-flv',
      'video/3gpp',
    ];

    if (file.mimetype.startsWith('image/')) {
      return AttachmentType.IMAGE;
    } else if (file.mimetype.startsWith('video/') || videoMimeTypes.includes(file.mimetype)) {
      return AttachmentType.VIDEO;
    } else if (file.mimetype.startsWith('application/')) {
      return AttachmentType.DOCUMENT;
    } else {
      return AttachmentType.UNKNOWN;
    }
  }

  /**
   * Invalidate attachment cache
   */
  async invalidateCache(attachmentId: string): Promise<void> {
    const cacheKey = `${this.ATTACHMENT_CACHE_PREFIX}${attachmentId}`;
    await this.redisClient.del(cacheKey);
  }
}
