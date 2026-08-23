import { Injectable, Logger } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import { IFileUploadStrategy, FileUploadResult } from './file-upload.strategy.interface';

/**
 * Cloudinary File Upload Strategy
 * 
 * 📚 STRATEGY PATTERN IMPLEMENTATION
 * 
 * Implements file upload using Cloudinary
 * 
 * Features:
 * ✅ Automatic folder creation
 * ✅ Public ID generation
 * ✅ File transformation support
 * ✅ CDN delivery
 */
@Injectable()
export class CloudinaryStrategy implements IFileUploadStrategy {
  private readonly logger = new Logger(CloudinaryStrategy.name);

  constructor() {
    // Configure Cloudinary
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure: true,
    });
  }

  /**
   * Upload file to Cloudinary
   */
  async uploadFile(file: Express.Multer.File, folder: string): Promise<FileUploadResult> {
    try {
      // Convert buffer to base64
      const base64File = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;

      // Upload to Cloudinary
      const result = await new Promise<any>((resolve, reject) => {
        cloudinary.uploader.upload(
          base64File,
          {
            folder: `task-mgmt/${folder}`,
            resource_type: 'auto',
            transformation: [
              { quality: 'auto:good' }, // Auto quality optimization
              { fetch_format: 'auto' }, // Auto format optimization
            ],
          },
          (error, result) => {
            if (error) {
              reject(error);
            } else {
              resolve(result);
            }
          },
        );
      });

      this.logger.log(`File uploaded to Cloudinary: ${result.secure_url}`);

      return {
        url: result.secure_url,
        publicId: result.public_id,
        size: result.bytes,
        mimeType: result.format,
      };
    } catch (error) {
      this.logger.error(`Cloudinary upload failed: ${error.message}`);
      throw new Error(`Failed to upload file to Cloudinary: ${error.message}`);
    }
  }

  /**
   * Delete file from Cloudinary
   */
  async deleteFile(publicIdOrUrl: string): Promise<void> {
    try {
      // Extract public_id from URL if URL is provided
      let publicId = publicIdOrUrl;
      if (publicIdOrUrl.includes('cloudinary.com')) {
        const match = publicIdOrUrl.match(/\/upload\/v\d+\/(.+)$/);
        if (match) {
          publicId = match[1].replace(/\.[^/.]+$/, ''); // Remove extension
        }
      }

      const result = await cloudinary.uploader.destroy(publicId);

      if (result.result !== 'ok') {
        throw new Error(`Cloudinary deletion failed: ${result.result}`);
      }

      this.logger.log(`File deleted from Cloudinary: ${publicId}`);
    } catch (error) {
      this.logger.error(`Cloudinary deletion failed: ${error.message}`);
      throw new Error(`Failed to delete file from Cloudinary: ${error.message}`);
    }
  }

  /**
   * Get strategy name
   */
  getStrategyName(): string {
    return 'cloudinary';
  }
}
