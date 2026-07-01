import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  StorageProvider,
  UploadOptions,
  UploadResult,
} from './interfaces/storage-provider.interface';
import { LocalStorageProvider } from './providers/local-storage.provider';
import { S3StorageProvider } from './providers/s3-storage.provider';

/**
 * Storage service abstracts away the underlying file storage backend.
 * Currently defaults to local storage; flip STORAGE_PROVIDER=s3 to switch to S3/R2.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly provider: StorageProvider;

  constructor(
    private readonly configService: ConfigService,
    local: LocalStorageProvider,
    s3: S3StorageProvider,
  ) {
    const configured = this.configService.get<string>(
      'STORAGE_PROVIDER',
      'local',
    );
    if (configured === 's3') {
      this.logger.log('Using S3 storage provider');
      this.provider = s3;
    } else {
      this.logger.log('Using local storage provider');
      this.provider = local;
    }
  }

  getProviderName(): string {
    return this.provider.name;
  }

  async upload(
    file: Express.Multer.File | Buffer,
    options: UploadOptions = {},
  ): Promise<UploadResult> {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    const isAvailable = this.provider.isAvailable();
    if (!isAvailable) {
      throw new BadRequestException(
        `Storage provider '${this.provider.name}' is not available. Check configuration.`,
      );
    }

    return this.provider.upload(file, options);
  }

  delete(key: string): Promise<void> {
    return this.provider.delete(key);
  }

  getUrl(key: string): string {
    return this.provider.getUrl(key);
  }
}
