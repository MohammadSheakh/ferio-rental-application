import { Module } from '@nestjs/common';
import { AttachmentController } from './attachment.controller';
import { AttachmentService } from './attachment.service';
import { RedisModule } from '@app/redis';
import { CloudinaryStrategy } from './strategies/cloudinary.strategy';
import { S3Strategy } from './strategies/s3.strategy';
import { FileUploadStrategyFactory } from './strategies/file-upload.strategy.factory';
import { IFileUploadStrategy } from './strategies/file-upload.strategy.interface';

/**
 * Attachment Module
 *
 * 📚 STRATEGY PATTERN IMPLEMENTATION
 * 
 * Manages file attachments with:
 * - Pluggable upload strategies (Cloudinary, S3, DigitalOcean)
 * - Strategy factory for easy switching
 * - File type detection
 * - Redis caching
 * - Soft delete support
 * - Generic CRUD operations
 * 
 * Configuration:
 * Set FILE_UPLOAD_STRATEGY environment variable to:
 * - 'cloudinary' (default)
 * - 's3'
 * - 'digitalocean'
 */
@Module({
  imports: [
    
    // Redis Module (for caching)
    RedisModule,
  ],
  controllers: [AttachmentController],
  providers: [
    AttachmentService,
    
    // Register strategies
    {
      provide: 'CLOUDINARY_STRATEGY',
      useClass: CloudinaryStrategy,
    },
    {
      provide: 'S3_STRATEGY',
      useClass: S3Strategy,
    },
    
    // Strategy factory
    FileUploadStrategyFactory,
    
    // Default strategy provider (uses factory)
    {
      provide: 'FILE_UPLOAD_STRATEGY',
      useFactory: (factory: FileUploadStrategyFactory): IFileUploadStrategy => {
        return factory.getDefaultStrategy();
      },
      inject: [FileUploadStrategyFactory],
    },
  ],
  exports: [AttachmentService],
})
export class AttachmentModule {}
