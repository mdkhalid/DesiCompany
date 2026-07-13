import { Module, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { readReplicaConfig } from '../config/database.config';
import { Logger } from '@nestjs/common';

const READ_DATA_SOURCE = 'READ_DATA_SOURCE';
const hasReadReplica = !!readReplicaConfig();

@Module({
  imports: hasReadReplica
    ? [
        TypeOrmModule.forRootAsync({
          name: READ_DATA_SOURCE,
          useFactory: (): TypeOrmModuleOptions =>
            readReplicaConfig() as TypeOrmModuleOptions,
        }),
      ]
    : [],
  providers: [],
})
export class ReadConnectionModule implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ReadConnectionModule.name);
  private dataSource: DataSource | null = null;

  onModuleInit() {
    const config = readReplicaConfig();
    if (config) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      const host = (config as any).host ?? 'unknown';
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      const port = (config as any).port ?? 5432;
      this.logger.log(`Read replica configured: ${host}:${port}`);
    }
  }

  onModuleDestroy() {
    // No-op; TypeORM manages connection lifecycle.
  }
}
