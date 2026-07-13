import { Module, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { readReplicaConfig } from '../config/database.config';
import { Logger } from '@nestjs/common';

const READ_DATA_SOURCE = 'READ_DATA_SOURCE';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      name: READ_DATA_SOURCE,
      useFactory: () => ({
        ...readReplicaConfig(),
      }),
    }),
  ],
  providers: [],
  exports: [READ_DATA_SOURCE],
})
export class ReadConnectionModule implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ReadConnectionModule.name);
  private dataSource: DataSource | null = null;

  onModuleInit() {
    const config = readReplicaConfig();
    if (config) {
      this.logger.log(
        `Read replica configured: ${config.host}:${config.port ?? 5432}`,
      );
    }
  }

  onModuleDestroy() {
    // No-op; TypeORM manages connection lifecycle.
  }
}
