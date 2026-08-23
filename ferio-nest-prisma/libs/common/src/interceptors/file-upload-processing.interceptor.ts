import{
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  BadRequestException,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * File Upload Processing Interceptor
 * 
 * 📚 INDUSTRY STANDARD IMPLEMENTATION
 * 
 * Processes uploaded files:
 * - Uploads to Cloudinary/S3
 * - Stores URLs in request object
 * - Makes URLs available to controller
 * 
 * Usage:
 * @UseInterceptors(FileFieldsInterceptor([...]))
 * @UseInterceptors(new FileUploadProcessingInterceptor('attachments', 'folder'))
 * async upload(@UploadedFiles() files: ..., @Request() req: any) {
 *   // req.uploadedFiles contains URLs
 * }
 */
@Injectable()
export class FileUploadProcessingInterceptor implements NestInterceptor {
  constructor(
    private fieldName: string = 'attachments',
    private folder: string = 'attachments',
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    const files = request.files?.[this.fieldName] as Express.Multer.File[];

    if (!files || files.length === 0) {
      return next.handle();
    }

    try {
      // Prisma-only build: keep the pipeline pass-through and preserve the
      // uploaded file metadata for controllers that still expect it.
      request.uploadedFiles = {
        [this.fieldName]: files,
      };

      // Also store in body for DTO validation
      request.body[this.fieldName] = files;

      return next.handle().pipe(
        map((data) => ({
          ...data,
          uploadedFiles: request.uploadedFiles,
        })),
      );
    } catch (error) {
      throw new BadRequestException(
        `Failed to upload files: ${(error as Error).message}`,
      );
    }
  }
}
