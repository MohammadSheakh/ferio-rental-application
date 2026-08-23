import {
  ArgumentMetadata,
  BadRequestException,
  Injectable,
  PipeTransform,
} from '@nestjs/common';

/**
 * File Upload Validation Pipe
 * 
 * 📚 INDUSTRY STANDARD IMPLEMENTATION
 * 
 * Validates uploaded files:
 * - Required field check
 * - MIME type validation
 * - File size validation
 * - File count validation
 * 
 * Usage:
 * @UseInterceptors(FileFieldsInterceptor([...]))
 * @UsePipes(new FileUploadValidationPipe([...]))
 * async upload(@UploadedFiles() files: ...) { ... }
 */
export interface FileUploadValidationOptions {
  name: string;
  folder: string;
  required?: boolean;
  maxCount?: number;
  allowedMimeTypes?: string[];
  maxSize?: number; // in bytes
}

@Injectable()
export class FileUploadValidationPipe implements PipeTransform {
  constructor(private options: FileUploadValidationOptions[]) {}

  transform(value: any, metadata: ArgumentMetadata) {
    // This pipe is used with @UploadedFiles() decorator
    const files = value as Express.Multer.File[] | Record<string, Express.Multer.File[]>;

    for (const option of this.options) {
      const fieldFiles = Array.isArray(files) 
        ? files 
        : (files[option.name] as Express.Multer.File[]);

      // ✅ 1. Required field check
      if (option.required && (!fieldFiles || fieldFiles.length === 0)) {
        throw new BadRequestException(
          `Missing required file field: ${option.name}`,
        );
      }

      // ✅ 2. Max count validation
      if (option.maxCount && fieldFiles && fieldFiles.length > option.maxCount) {
        throw new BadRequestException(
          `Field ${option.name} exceeds maximum file count of ${option.maxCount}`,
        );
      }

      // ✅ 3. MIME type validation
      if (option.allowedMimeTypes && fieldFiles && fieldFiles.length > 0) {
        const invalid = fieldFiles.some(
          (file) => !option.allowedMimeTypes!.includes(file.mimetype),
        );
        if (invalid) {
          throw new BadRequestException(
            `Invalid file type for field ${option.name}. Allowed types: ${option.allowedMimeTypes.join(', ')}`,
          );
        }
      }

      // ✅ 4. File size validation
      if (option.maxSize && fieldFiles && fieldFiles.length > 0) {
        const oversized = fieldFiles.some((file) => file.size > option.maxSize!);
        if (oversized) {
          throw new BadRequestException(
            `File size exceeds maximum of ${option.maxSize} bytes for field ${option.name}`,
          );
        }
      }
    }

    return value;
  }
}
