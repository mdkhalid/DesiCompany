import { Injectable, Logger } from '@nestjs/common';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class UploadsService {
  private readonly logger = new Logger(UploadsService.name);

  constructor(private readonly storage: StorageService) {}

  async uploadFile(file: Express.Multer.File, folder: string = 'misc') {
    return this.storage.upload(file, { folder, isPublic: true });
  }

  getFileUrl(key: string): string {
    return this.storage.getUrl(key);
  }

  async deleteFile(key: string): Promise<void> {
    await this.storage.delete(key);
    this.logger.log(`Deleted file: ${key}`);
  }

  getProviderName(): string {
    return this.storage.getProviderName();
  }
}
