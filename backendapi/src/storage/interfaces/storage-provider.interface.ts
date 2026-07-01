export interface UploadOptions {
  filename?: string;
  contentType?: string;
  folder?: string;
  isPublic?: boolean;
}

export interface UploadResult {
  url: string;
  key: string;
  size: number;
  mimetype: string;
  provider: string;
}

export interface StorageProvider {
  /** Provider name for identification */
  readonly name: string;

  /** Upload a file */
  upload(
    file: Express.Multer.File | Buffer,
    options: UploadOptions,
  ): Promise<UploadResult>;

  /** Delete a file by key */
  delete(key: string): Promise<void>;

  /** Get a URL for the file */
  getUrl(key: string): string;

  /** Check if the provider is configured/available */
  isAvailable(): boolean;
}
