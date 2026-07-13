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
  private primaryProvider: StorageProvider;
  private readonly localProvider: LocalStorageProvider;

  constructor(
    private readonly configService: ConfigService,
    local: LocalStorageProvider,
    s3: S3StorageProvider,
  ) {
    this.localProvider = local;
    const configured = this.configService.get<string>(
      'STORAGE_PROVIDER',
      'local',
    );
    if (configured === 's3') {
      this.logger.log('Using S3 storage provider (with local fallback)');
      this.primaryProvider = s3;
    } else {
      this.logger.log('Using local storage provider');
      this.primaryProvider = local;
    }
  }

  getProviderName(): string {
    return this.primaryProvider.name;
  }

  activeProvider(): StorageProvider {
    return this.primaryProvider;
  }

  async upload(
    file: Express.Multer.File | Buffer,
    options: UploadOptions = {},
  ): Promise<UploadResult> {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    const primary = this.primaryProvider;
    const isAvailable = primary.isAvailable();

    if (!isAvailable) {
      if (primary.name === 's3') {
        this.logger.warn(
          'S3 is not configured — using local fallback (prod placeholder mode)',
        );
        return this.localProvider.upload(file, options);
      }
      throw new BadRequestException(
        `Storage provider '${primary.name}' is not available. Check configuration.`,
      );
    }

    try {
      return await primary.upload(file, options);
    } catch (err) {
      if (primary.name === 's3') {
        this.logger.warn(
          `S3 upload failed, falling back to local storage: ${(err as Error).message}`,
        );
        return this.localProvider.upload(file, options);
      }
      throw err;
    }
  }

  async delete(key: string): Promise<void> {
    const primary = this.primaryProvider;
    if (primary.name === 's3') {
      try {
        await primary.delete(key);
      } catch (err) {
        this.logger.warn(
          `S3 delete failed, skipping local fallback for key ${key}: ${(err as Error).message}`,
        );
      }
      return;
    }
    await primary.delete(key);
  }

  getUrl(key: string): string {
    const primary = this.primaryProvider;
    if (primary.name === 's3') {
      try {
        return primary.getUrl(key);
      } catch (err) {
        this.logger.warn(
          `S3 getUrl failed, returning local URL for key ${key}: ${(err as Error).message}`,
        );
        return this.localProvider.getUrl(key);
      }
    }
    return primary.getUrl(key);
  }
}
