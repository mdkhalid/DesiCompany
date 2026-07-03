import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StorageService } from './storage.service';
import { LocalStorageProvider } from './providers/local-storage.provider';
import { S3StorageProvider } from './providers/s3-storage.provider';

@Module({
  providers: [
    LocalStorageProvider,
    {
      provide: StorageService,
      useFactory: (
        configService: ConfigService,
        local: LocalStorageProvider,
      ) => {
        const configured = configService.get<string>(
          'STORAGE_PROVIDER',
          'local',
        );
        if (configured === 's3') {
          const s3 = new S3StorageProvider(configService);
          return new StorageService(configService, local, s3);
        }
        // When using local storage, pass local as both params —
        // S3StorageProvider is never instantiated, avoiding the missing-env crash.
        return new StorageService(
          configService,
          local,
          local as unknown as S3StorageProvider,
        );
      },
      inject: [ConfigService, LocalStorageProvider],
    },
  ],
  exports: [StorageService],
})
export class StorageModule {}
