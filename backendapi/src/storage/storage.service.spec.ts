import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StorageService } from './storage.service';
import { LocalStorageProvider } from './providers/local-storage.provider';
import { S3StorageProvider } from './providers/s3-storage.provider';

describe('StorageService', () => {
  let service: StorageService;
  let mockLocalProvider: {
    name: string;
    upload: jest.Mock;
    delete: jest.Mock;
    getUrl: jest.Mock;
    isAvailable: jest.Mock;
  };
  let mockS3Provider: {
    name: string;
    upload: jest.Mock;
    delete: jest.Mock;
    getUrl: jest.Mock;
    isAvailable: jest.Mock;
  };

  function createService(storageProvider: string) {
    mockLocalProvider = {
      name: 'local',
      upload: jest.fn(),
      delete: jest.fn(),
      getUrl: jest.fn(),
      isAvailable: jest.fn().mockReturnValue(true),
    };
    mockS3Provider = {
      name: 's3',
      upload: jest.fn(),
      delete: jest.fn(),
      getUrl: jest.fn(),
      isAvailable: jest.fn().mockReturnValue(true),
    };

    return Test.createTestingModule({
      providers: [
        StorageService,
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue(storageProvider) } },
        { provide: LocalStorageProvider, useValue: mockLocalProvider },
        { provide: S3StorageProvider, useValue: mockS3Provider },
      ],
    }).compile();
  }

  afterEach(() => jest.clearAllMocks());

  it('should use local provider by default', async () => {
    const module = await createService('local');
    service = module.get<StorageService>(StorageService);

    expect(service.getProviderName()).toBe('local');
  });

  it('should use S3 provider when configured', async () => {
    const module = await createService('s3');
    service = module.get<StorageService>(StorageService);

    expect(service.getProviderName()).toBe('s3');
  });

  describe('upload', () => {
    it('should throw BadRequestException when no file provided', async () => {
      const module = await createService('local');
      service = module.get<StorageService>(StorageService);

      await expect(service.upload(null as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when provider unavailable', async () => {
      const module = await createService('local');
      service = module.get<StorageService>(StorageService);
      mockLocalProvider.isAvailable.mockReturnValue(false);

      await expect(
        service.upload({ buffer: Buffer.from('test') } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should upload file via active provider', async () => {
      const module = await createService('local');
      service = module.get<StorageService>(StorageService);
      mockLocalProvider.upload.mockResolvedValue({ url: 'http://file.jpg', key: 'k', size: 100, mimetype: 'image/jpeg', provider: 'local' });

      const result = await service.upload(
        { buffer: Buffer.from('test') } as any,
        { folder: 'kyc' },
      );

      expect(result.url).toBe('http://file.jpg');
      expect(mockLocalProvider.upload).toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('should delegate to active provider', async () => {
      const module = await createService('local');
      service = module.get<StorageService>(StorageService);

      await service.delete('key1');
      expect(mockLocalProvider.delete).toHaveBeenCalledWith('key1');
    });
  });

  describe('getUrl', () => {
    it('should delegate to active provider', async () => {
      const module = await createService('local');
      service = module.get<StorageService>(StorageService);
      mockLocalProvider.getUrl.mockReturnValue('http://file.jpg');

      const result = service.getUrl('key1');
      expect(result).toBe('http://file.jpg');
    });
  });
});
