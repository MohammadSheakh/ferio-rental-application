/**
 * File Upload Result
 */
export interface FileUploadResult {
  url: string;
  publicId?: string;
  size?: number;
  mimeType?: string;
}

/**
 * File Upload Strategy Interface
 * 
 * 📚 STRATEGY PATTERN IMPLEMENTATION
 * 
 * Defines the contract for file upload strategies
 * Allows easy switching between Cloudinary, S3, DigitalOcean, etc.
 * 
 * Usage:
 * // In module provider
 * {
 *   provide: 'FILE_UPLOAD_STRATEGY',
 *   useClass: CloudinaryStrategy, // or S3Strategy
 * }
 */
export interface IFileUploadStrategy {
  /**
   * Upload file to cloud storage
   * 
   * @param file - Uploaded file from multer
   * @param folder - Folder name in cloud storage
   * @returns Upload result with URL and publicId
   */
  uploadFile(file: Express.Multer.File, folder: string): Promise<FileUploadResult>;

  /**
   * Delete file from cloud storage
   * 
   * @param publicIdOrUrl - Public ID or URL of file to delete
   */
  deleteFile(publicIdOrUrl: string): Promise<void>;

  /**
   * Get strategy name
   */
  getStrategyName(): string;
}

/**
 * File Upload Strategy Type
 */
export type FileUploadStrategyType = 'cloudinary' | 's3' | 'digitalocean' | 'local';
