import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import {
  StorageProvider,
  UploadOptions,
  UploadResult,
} from '../interfaces/storage-provider.interface';

/**
 * Local filesystem storage provider.
 * Used for development. In production, replace with S3/R2 provider.
 */
@Injectable()
export class LocalStorageProvider implements StorageProvider {
  readonly name = 'local';
  private readonly logger = new Logger(LocalStorageProvider.name);
  private readonly uploadRoot: string;

  constructor(private readonly configService: ConfigService) {
    this.uploadRoot = path.resolve(
      process.cwd(),
      this.configService.get<string>('UPLOAD_DEST', './uploads'),
    );
    if (!fs.existsSync(this.uploadRoot)) {
      fs.mkdirSync(this.uploadRoot, { recursive: true });
    }
  }

  async upload(
    file: Express.Multer.File | Buffer,
    options: UploadOptions,
  ): Promise<UploadResult> {
    const folder = options.folder ?? 'misc';
    const filename = options.filename ?? randomUUID();
    const dir = path.join(this.uploadRoot, folder);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const filePath = path.join(dir, filename);
    let buffer: Buffer;
    let mimetype: string;

    if (Buffer.isBuffer(file)) {
      buffer = file;
      mimetype = options.contentType ?? 'application/octet-stream';
    } else {
      buffer = file.buffer;
      mimetype =
        file.mimetype ?? options.contentType ?? 'application/octet-stream';
    }

    await fs.promises.writeFile(filePath, buffer);

    const baseUrl = this.configService.get<string>(
      'APP_URL',
      'http://localhost:3000',
    );
    const url =
      options.isPublic !== false
        ? `${baseUrl}/uploads/${folder}/${filename}`
        : `${baseUrl}/uploads/private/${folder}/${filename}`;

    this.logger.log(`File uploaded to ${filePath}`);

    return {
      url,
      key: `${folder}/${filename}`,
      size: buffer.length,
      mimetype,
      provider: this.name,
    };
  }

  async delete(key: string): Promise<void> {
    const filePath = path.join(this.uploadRoot, key);
    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
      this.logger.log(`Deleted file: ${filePath}`);
    }
  }

  getUrl(key: string): string {
    const baseUrl = this.configService.get<string>(
      'APP_URL',
      'http://localhost:3000',
    );
    return `${baseUrl}/uploads/${key}`;
  }

  isAvailable(): boolean {
    return true;
  }
}
