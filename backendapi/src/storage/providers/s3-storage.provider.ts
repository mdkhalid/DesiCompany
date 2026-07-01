import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';
import {
  StorageProvider,
  UploadOptions,
  UploadResult,
} from '../interfaces/storage-provider.interface';

/**
 * S3-compatible storage provider (AWS S3, Cloudflare R2, MinIO, DigitalOcean Spaces).
 * Activated when STORAGE_PROVIDER=s3 is configured.
 */
@Injectable()
export class S3StorageProvider implements StorageProvider {
  readonly name = 's3';
  private readonly logger = new Logger(S3StorageProvider.name);
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(private readonly configService: ConfigService) {
    this.bucket = this.configService.getOrThrow<string>('S3_BUCKET');
    this.client = new S3Client({
      region: this.configService.getOrThrow<string>('AWS_REGION'),
      credentials: {
        accessKeyId: this.configService.getOrThrow<string>('AWS_ACCESS_KEY_ID'),
        secretAccessKey: this.configService.getOrThrow<string>(
          'AWS_SECRET_ACCESS_KEY',
        ),
      },
    });
  }

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

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: buffer,
      ContentType: mimetype,
      ACL: options.isPublic !== false ? 'public-read' : 'private',
    });

    await this.client.send(command);

    return {
      url: this.getUrl(key),
      key,
      size: buffer.length,
      mimetype,
      provider: this.name,
    };
  }

  async delete(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });
    await this.client.send(command);
    this.logger.log(`Deleted object: ${key}`);
  }

  getUrl(key: string): string {
    const cdnUrl = this.configService.get<string>('CDN_URL');
    const endpoint = this.configService.get<string>('S3_PUBLIC_URL');
    const region = this.configService.get<string>('AWS_REGION', 'us-east-1');
    return `${cdnUrl ?? endpoint ?? `https://${this.bucket}.s3.${region}.amazonaws.com`}/${key}`;
  }

  isAvailable(): boolean {
    return !!(
      this.configService.get('S3_BUCKET') &&
      this.configService.get('AWS_REGION')
    );
  }
}
