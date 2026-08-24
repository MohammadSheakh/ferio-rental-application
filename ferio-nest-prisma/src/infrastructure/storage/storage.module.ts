import { Module, Global } from '@nestjs/common';
import { StorageService } from './storage.service';

/**
 * Global storage provider — S3-compatible object storage with a
 * local-disk development fallback (§13 secure uploads).
 */
@Global()
@Module({
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}
