import { Injectable, Logger } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  ObjectCannedACL,
} from '@aws-sdk/client-s3';
import { IFileUploadStrategy, FileUploadResult } from './file-upload.strategy.interface';

/**
 * S3/DigitalOcean File Upload Strategy
 * 
 * 📚 STRATEGY PATTERN IMPLEMENTATION
 * 
 * Implements file upload using AWS S3 or DigitalOcean Spaces
 * 
 * Features:
 * ✅ S3 compatible (AWS, DigitalOcean, Minio, etc.)
 * ✅ Automatic folder creation
 * ✅ CDN URL support
 * ✅ Public read ACL
 */
@Injectable()
export class S3Strategy implements IFileUploadStrategy {
  private readonly logger = new Logger(S3Strategy.name);
  private readonly s3Client: S3Client;

  constructor() {
    // Initialize S3 client
    this.s3Client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
      // For DigitalOcean Spaces, uncomment:
      // endpoint: `https://${process.env.AWS_REGION}.digitaloceanspaces.com`,
    });
  }

  /**
   * Upload file to S3/DigitalOcean
   */
  async uploadFile(file: Express.Multer.File, folder: string): Promise<FileUploadResult> {
    try {
      const fileName = `${folder}/${Date.now()}-${file.originalname.replace(/\s+/g, '-')}`;

      const uploadParams = {
        Bucket: process.env.AWS_BUCKET_NAME!,
        Key: fileName,
        Body: file.buffer,
        ACL: ObjectCannedACL.public_read,
        ContentType: file.mimetype,
      };

      const command = new PutObjectCommand(uploadParams);
      await this.s3Client.send(command);

      // Use CDN URL for better performance (DigitalOcean)
      // const fileUrl = `https://${process.env.AWS_BUCKET_NAME}.${process.env.AWS_REGION}.cdn.digitaloceanspaces.com/${fileName}`;
      
      // Use S3 URL
      const fileUrl = `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;

      this.logger.log(`File uploaded to S3: ${fileUrl}`);

      return {
        url: fileUrl,
        publicId: fileName,
        size: file.size,
        mimeType: file.mimetype,
      };
    } catch (error) {
      this.logger.error(`S3 upload failed: ${error.message}`);
      throw new Error(`Failed to upload file to S3: ${error.message}`);
    }
  }

  /**
   * Delete file from S3/DigitalOcean
   */
  async deleteFile(publicIdOrUrl: string): Promise<void> {
    try {
      // Extract key from URL if URL is provided
      let fileKey = publicIdOrUrl;
      if (publicIdOrUrl.includes('amazonaws.com')) {
        const match = publicIdOrUrl.match(/\.amazonaws\.com\/(.+)$/);
        if (match) {
          fileKey = match[1];
        }
      } else if (publicIdOrUrl.includes('digitaloceanspaces.com')) {
        const match = publicIdOrUrl.match(/\.digitaloceanspaces\.com\/(.+)$/);
        if (match) {
          fileKey = match[1];
        }
      }

      const deleteParams = {
        Bucket: process.env.AWS_BUCKET_NAME!,
        Key: fileKey,
      };

      const command = new DeleteObjectCommand(deleteParams);
      await this.s3Client.send(command);

      this.logger.log(`File deleted from S3: ${fileKey}`);
    } catch (error) {
      this.logger.error(`S3 deletion failed: ${error.message}`);
      throw new Error(`Failed to delete file from S3: ${error.message}`);
    }
  }

  /**
   * Get strategy name
   */
  getStrategyName(): string {
    return 's3';
  }
}
