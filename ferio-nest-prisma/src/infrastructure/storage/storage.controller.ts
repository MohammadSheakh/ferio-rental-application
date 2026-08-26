import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { StorageService } from './storage.service';

const CONTENT_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  pdf: 'application/pdf',
  dump: 'application/octet-stream',
};

@Controller('storage')
export class StorageController {
  constructor(private readonly storage: StorageService) {}

  @Get('objects')
  async download(
    @Query('key') key: string,
    @Query('expires') expiresRaw: string,
    @Query('signature') signature: string,
    @Res() response: Response,
  ) {
    const expires = Number(expiresRaw);
    if (!key || !expiresRaw || !signature) {
      throw new BadRequestException('key, expires and signature are required');
    }
    this.storage.assertSignedDownload(key, expires, signature);
    let body: Buffer;
    try {
      body = await this.storage.getRawObject(key);
    } catch (error: any) {
      if (error?.code === 'ENOENT' || error?.name === 'NoSuchKey') {
        throw new NotFoundException('Stored object not found');
      }
      throw error;
    }
    const extension = key.split('.').pop()?.toLowerCase() ?? '';
    response.setHeader('Content-Type', CONTENT_TYPES[extension] ?? 'application/octet-stream');
    response.setHeader('Cache-Control', 'private, no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.send(body);
  }
}
