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
import { ActiveMemberGuard } from '../tenant-operations/member-access.guard';
import { JwtAuthGuard } from '../../infrastructure/identity/jwt-auth.guard';
import { StorageService } from '../../infrastructure/storage/storage.service';

const imageUpload = FileInterceptor('file', {
  storage: memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

/**
 * Tenant-plane uploads — any ACTIVE workspace member can upload photos
 * for maintenance issues, payment proofs or meter readings. Returns a
 * URL to register against the relevant record's photo/proof field.
 */
@ApiTags('Tenant — Uploads')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ActiveMemberGuard)
@Controller('tenant/uploads')
export class TenantUploadController {
  constructor(private readonly storage: StorageService) {}

  @Post('images')
  @UseInterceptors(imageUpload)
  @ApiBody({
    schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } },
  })
  @ApiOperation({ summary: 'Upload a photo (jpeg/png/webp ≤5MB) → { url }' })
  async uploadImage(@UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('file is required (multipart field "file")');
    return this.storage.upload('images', file);
  }
}
