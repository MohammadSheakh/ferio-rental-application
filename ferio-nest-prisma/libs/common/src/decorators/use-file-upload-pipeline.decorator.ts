import { applyDecorators, UseInterceptors, UsePipes } from '@nestjs/common';
import {
  FileFieldsInterceptor,
  FilesInterceptor,
  FileInterceptor,
} from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { FileUploadValidationPipe, FileUploadValidationOptions } from '../pipes/file-upload-validation.pipe';
import { FileUploadProcessingInterceptor } from '../interceptors/file-upload-processing.interceptor';

/**
 * File Upload Pipeline Configuration
 * 
 * 📚 INDUSTRY STANDARD IMPLEMENTATION
 * 
 * Creates a reusable file upload pipeline similar to Express.js middleware
 * but using NestJS decorators and interceptors
 * 
 * Usage:
 * @UseFileUploadPipeline({
 *   fieldName: 'attachments',
 *   folder: 'tasks',
 *   maxCount: 10,
 *   required: true,
 *   allowedMimeTypes: ['image/jpeg', 'image/png'],
 * })
 * async upload(@UploadedFiles() files: ...) { ... }
 */
export interface FileUploadPipelineOptions {
  /** Field name for file upload */
  fieldName: string;
  
  /** Folder name for cloud storage */
  folder: string;
  
  /** Maximum number of files */
  maxCount?: number;
  
  /** Is file required */
  required?: boolean;
  
  /** Allowed MIME types */
  allowedMimeTypes?: string[];
  
  /** Maximum file size in bytes */
  maxSize?: number;
  
  /** Upload destination (memory/disk) */
  storage?: 'memory' | 'disk';
  
  /** Disk storage path (if storage is 'disk') */
  dest?: string;
}

/**
 * File Upload Pipeline Decorator
 * 
 * Combines:
 * 1. Multer interceptor (file upload)
 * 2. Validation pipe (file validation)
 * 3. Processing interceptor (cloud upload)
 */
export function UseFileUploadPipeline(options: FileUploadPipelineOptions) {
  const {
    fieldName,
    folder,
    maxCount = 10,
    required = false,
    allowedMimeTypes,
    maxSize = 10 * 1024 * 1024, // 10MB default
    storage = 'memory',
    dest = './uploads/temp',
  } = options;

  // Configure multer storage
  const multerStorage =
    storage === 'memory'
      ? diskStorage({
          // Memory storage (files in req.files)
          destination: (req, file, callback) => {
            callback(null, dest);
          },
          filename: (req, file, callback) => {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
            const ext = extname(file.originalname);
            callback(null, `${fieldName}-${uniqueSuffix}${ext}`);
          },
        })
      : diskStorage({
          // Disk storage
          destination: dest,
          filename: (req, file, callback) => {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
            const ext = extname(file.originalname);
            callback(null, `${fieldName}-${uniqueSuffix}${ext}`);
          },
        });

  // Validation options
  const validationOptions: FileUploadValidationOptions[] = [
    {
      name: fieldName,
      folder,
      required,
      maxCount,
      allowedMimeTypes,
      maxSize,
    },
  ];

  // Combine decorators
  return applyDecorators(
    // 1. Multer file upload interceptor
    UseInterceptors(
      FileFieldsInterceptor(
        [{ name: fieldName, maxCount }],
        {
          storage: multerStorage,
          limits: {
            fileSize: maxSize,
          },
        },
      ),
    ),
    
    // 2. Validation pipe
    UsePipes(new FileUploadValidationPipe(validationOptions)),
    
    // 3. Processing interceptor (upload to cloud)
    UseInterceptors(new FileUploadProcessingInterceptor(fieldName, folder)),
  );
}

/**
 * Single File Upload Pipeline
 * 
 * Simplified version for single file uploads
 */
export function UseSingleFileUpload(options: Omit<FileUploadPipelineOptions, 'maxCount'>) {
  return UseFileUploadPipeline({
    ...options,
    maxCount: 1,
  });
}

/**
 * Multiple Files Upload Pipeline
 * 
 * Simplified version for multiple file uploads
 */
export function UseMultipleFilesUpload(options: FileUploadPipelineOptions) {
  return UseFileUploadPipeline(options);
}
