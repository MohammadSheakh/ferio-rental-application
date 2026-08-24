import {
  Controller,
  Post,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../infrastructure/identity/jwt-auth.guard';
import { StorageService } from '../../infrastructure/storage/storage.service';

const imageUpload = FileInterceptor('file', {
  storage: memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});
const documentUpload = FileInterceptor('file', {
  storage: memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

/**
 * §13 Secure uploads — authenticated multipart upload returning a stable
 * public URL. The URL is then registered against listing media,
 * documents or room photos via the existing URL-registration endpoints.
 * Backed by S3-compatible object storage in production; local disk in dev.
 */
@ApiTags('Marketplace — Uploads')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('marketplace/uploads')
export class MarketplaceUploadController {
  constructor(private readonly storage: StorageService) {}

  @Post('images')
  @UseInterceptors(imageUpload)
  @ApiBody({
    schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } },
  })
  @ApiOperation({ summary: 'Upload a listing/room photo (jpeg/png/webp ≤5MB) → { url }' })
  async uploadImage(@UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('file is required (multipart field "file")');
    return this.storage.upload('images', file);
  }

  @Post('documents')
  @UseInterceptors(documentUpload)
  @ApiBody({
    schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } },
  })
  @ApiOperation({ summary: 'Upload a sale/legal document (pdf/jpeg/png ≤10MB) → { url }' })
  async uploadDocument(@UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('file is required (multipart field "file")');
    return this.storage.upload('documents', file);
  }
}
