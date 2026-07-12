import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { IdempotencyKey } from './entities/idempotency-key.entity';

@Injectable()
export class IdempotencyService {
  private readonly logger = new Logger(IdempotencyService.name);

  constructor(
    @InjectRepository(IdempotencyKey)
    private readonly repo: Repository<IdempotencyKey>,
    private readonly dataSource: DataSource,
  ) {}

  async withLock<T>(
    key: string,
    ttlSeconds = 300,
    fn: () => Promise<T>,
  ): Promise<T> {
    const result = await this.dataSource.transaction(async (manager) => {
      const existing = (await manager.findOne(IdempotencyKey, {
        where: { key },
      })) as IdempotencyKey | undefined;

      if (existing) {
        return existing.result as T;
      }

      const value = (await fn()) as T;

      const record = manager.create(IdempotencyKey, {
        key,
        result: value,
        expiresAt: new Date(Date.now() + ttlSeconds * 1000),
      });
      await manager.save(IdempotencyKey, record);

      return value;
    });

    return result;
  }
}
