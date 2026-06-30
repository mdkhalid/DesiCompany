import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, MoreThan } from 'typeorm';
import { ErrorLog } from './entities/error-log.entity';

@Injectable()
export class ErrorLogsService {
  private readonly logger = new Logger(ErrorLogsService.name);

  constructor(
    @InjectRepository(ErrorLog)
    private readonly errorLogRepository: Repository<ErrorLog>,
  ) {}

  async create(data: Partial<ErrorLog>): Promise<ErrorLog> {
    return this.errorLogRepository.save(data);
  }

  async findAll(
    page = 1,
    limit = 50,
    filters?: { statusCode?: number; userId?: string },
  ): Promise<{ items: ErrorLog[]; total: number }> {
    const where: Record<string, unknown> = {};
    if (filters?.statusCode) where.statusCode = filters.statusCode;
    if (filters?.userId) where.userId = filters.userId;

    const [items, total] = await this.errorLogRepository.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { items, total };
  }

  async findOne(id: string): Promise<ErrorLog | null> {
    return this.errorLogRepository.findOneBy({ id });
  }

  async resolve(id: string, resolvedBy: string): Promise<ErrorLog | null> {
    const result = await this.errorLogRepository.update(id, {
      resolvedAt: new Date(),
      resolvedBy,
    });
    if ((result.affected ?? 0) === 0) {
      return null;
    }
    return this.findOne(id);
  }

  async getStats(): Promise<{
    total: number;
    byStatusCode: Record<string, number>;
    last24h: number;
    last7d: number;
  }> {
    const now = new Date();
    const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const since7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [last24hCount, last7dCount, total] = await Promise.all([
      this.errorLogRepository.count({
        where: { createdAt: MoreThan(since24h) },
      }),
      this.errorLogRepository.count({
        where: { createdAt: MoreThan(since7d) },
      }),
      this.errorLogRepository.count(),
    ]);

    const statusCounts = await this.errorLogRepository
      .createQueryBuilder('error_log')
      .select('error_log.statusCode', 'statusCode')
      .addSelect('COUNT(*)', 'count')
      .groupBy('error_log.statusCode')
      .getRawMany<{ statusCode: number; count: string }>();

    const byStatusCode: Record<string, number> = {};
    for (const row of statusCounts) {
      byStatusCode[String(row.statusCode)] = parseInt(row.count, 10);
    }

    return {
      total,
      byStatusCode,
      last24h: last24hCount,
      last7d: last7dCount,
    };
  }

  async purgeOlderThan(days: number): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const result = await this.errorLogRepository.delete({
      createdAt: LessThan(cutoff),
    });

    this.logger.log(
      `Purged ${result.affected ?? 0} error logs older than ${days} days`,
    );
    return result.affected ?? 0;
  }

  @Cron('0 0 0 * * *')
  async handlePurgeCron() {
    const retentionDays = parseInt(
      process.env.ERROR_LOG_RETENTION_DAYS || '30',
      10,
    );
    try {
      const deleted = await this.purgeOlderThan(retentionDays);
      if (deleted > 0) {
        this.logger.log(
          `[Cron] Purged ${deleted} error logs older than ${retentionDays} days`,
        );
      }
    } catch (err) {
      this.logger.error(
        '[Cron] Failed to purge error logs',
        (err as Error).stack,
      );
    }
  }
}
