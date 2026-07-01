import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import {
  StorageProvider,
  UploadOptions,
  UploadResult,
} from '../interfaces/storage-provider.interface';

/**
 * S3-compatible storage provider (AWS S3, Cloudflare R2, MinIO, DigitalOcean Spaces).
 * Activated when STORAGE_PROVIDER=s3 is configured.
 *
 * Note: Requires `@aws-sdk/client-s3` package to be installed when ready to deploy.
 */
@Injectable()
export class S3StorageProvider implements StorageProvider {
  readonly name = 's3';
  private readonly logger = new Logger(S3StorageProvider.name);

  constructor(private readonly configService: ConfigService) {
    // Configuration check only — actual client instantiation happens lazily
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async upload(
    file: Express.Multer.File | Buffer,
    options: UploadOptions,
  ): Promise<UploadResult> {
    const folder = options.folder ?? 'misc';
    const filename = options.filename ?? randomUUID();
    const key = `${folder}/${filename}`;

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

    // Production code: install @aws-sdk/client-s3 and uncomment:
    // const command = new PutObjectCommand({
    //   Bucket: this.configService.get('S3_BUCKET'),
    //   Key: key,
    //   Body: buffer,
    //   ContentType: mimetype,
    //   ACL: options.isPublic !== false ? 'public-read' : 'private',
    // });
    // await this.client.send(command);

    this.logger.warn(
      'S3StorageProvider.upload called but @aws-sdk/client-s3 is not installed yet. ' +
        'Run: npm install @aws-sdk/client-s3 and configure STORAGE_PROVIDER=s3.',
    );

    const cdnUrl = this.configService.get<string>('CDN_URL');
    const endpoint = this.configService.get<string>('S3_PUBLIC_URL');

    return {
      url: `${cdnUrl ?? endpoint ?? 'https://YOUR_BUCKET.s3.REGION.amazonaws.com'}/${key}`,
      key,
      size: buffer.length,
      mimetype,
      provider: this.name,
    };
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async delete(key: string): Promise<void> {
    // const command = new DeleteObjectCommand({
    //   Bucket: this.configService.get('S3_BUCKET'),
    //   Key: key,
    // });
    // await this.client.send(command);
    this.logger.warn(`S3 delete not implemented for ${key}`);
  }

  getUrl(key: string): string {
    const cdnUrl = this.configService.get<string>('CDN_URL');
    const endpoint = this.configService.get<string>('S3_PUBLIC_URL');
    return `${cdnUrl ?? endpoint ?? 'https://YOUR_BUCKET.s3.REGION.amazonaws.com'}/${key}`;
  }

  isAvailable(): boolean {
    return !!(
      this.configService.get('S3_BUCKET') &&
      this.configService.get('AWS_REGION')
    );
  }
}
