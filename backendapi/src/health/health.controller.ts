import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import Redis from 'ioredis';
import { CacheService } from '../common/cache.service';
import { JobQueueService } from '../jobs/job-queue.service';

@Controller('health')
export class HealthController {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly cacheService: CacheService,
    private readonly jobQueueService: JobQueueService,
  ) {}

  /** Create a short-lived Redis client for a single probe, then disconnect. */
  private async probeRedis(): Promise<{ ok: boolean; responseTime: number }> {
    const client = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      lazyConnect: true,
      connectTimeout: 3000,
      maxRetriesPerRequest: 0,
      retryStrategy: () => null,
    });
    // Suppress the unhandled-error event that ioredis emits on connection failure.
    client.on('error', () => {});

    const start = Date.now();
    try {
      await client.connect();
      await client.ping();
      return { ok: true, responseTime: Date.now() - start };
    } catch {
      return { ok: false, responseTime: Date.now() - start };
    } finally {
      client.disconnect();
    }
  }

  @Get()
  async check() {
    const checks = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '0.1.0',
      environment: process.env.NODE_ENV || 'development',
      uptime: process.uptime(),
      services: {
        database: { status: 'unknown', responseTime: 0 },
        redis: { status: 'unknown', responseTime: 0 },
        cache: { status: 'unknown', responseTime: 0 },
        queue: { status: 'unknown', responseTime: 0 },
      },
    };

    let hasError = false;

    // Check database
    try {
      const dbStart = Date.now();
      await this.dataSource.query('SELECT 1');
      checks.services.database = {
        status: 'connected',
        responseTime: Date.now() - dbStart,
      };
    } catch {
      hasError = true;
      checks.services.database = {
        status: 'disconnected',
        responseTime: 0,
      };
    }

    // Check Redis
    const redisProbe = await this.probeRedis();
    if (redisProbe.ok) {
      checks.services.redis = {
        status: 'connected',
        responseTime: redisProbe.responseTime,
      };
    } else {
      hasError = true;
      checks.services.redis = {
        status: 'disconnected',
        responseTime: redisProbe.responseTime,
      };
    }

    // Check cache service
    const cacheStart = Date.now();
    const cacheConnected = this.cacheService.isConnected();
    checks.services.cache = {
      status: cacheConnected ? 'connected' : 'disconnected',
      responseTime: Date.now() - cacheStart,
    };
    if (!cacheConnected) hasError = true;

    // Check job queue
    const queueStart = Date.now();
    try {
      const q = this.jobQueueService.getQueue();
      let count = 0;
      if (typeof q === 'object' && q !== null) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if (typeof (q as any).getWaitingCount === 'function') {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
          count = await (q as any).getWaitingCount();
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        } else if (typeof (q as any).size === 'number') {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
          count = (q as any).size;
        }
      }
      checks.services.queue = {
        status: 'connected',
        responseTime: Date.now() - queueStart,
        waitingJobs: count,
      };
    } catch {
      hasError = true;
      checks.services.queue = {
        status: 'disconnected',
        responseTime: Date.now() - queueStart,
      };
    }

    if (hasError) {
      checks.status = 'error';
    }

    return checks;
  }

  @Get('ready')
  async ready() {
    try {
      await this.dataSource.query('SELECT 1');
    } catch {
      throw new HttpException(
        { status: 'not ready' },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    const redisProbe = await this.probeRedis();
    if (!redisProbe.ok) {
      throw new HttpException(
        { status: 'not ready' },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    if (!this.cacheService.isConnected()) {
      throw new HttpException(
        { status: 'not ready', reason: 'cache disconnected' },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    try {
      const q = this.jobQueueService.getQueue();
      const count =
        typeof q.getWaitingCount === 'function'
          ? await q.getWaitingCount()
          : typeof q.size === 'number'
            ? q.size
            : 0;
      if (count < 0) {
        throw new Error('Queue not ready');
      }
    } catch {
      throw new HttpException(
        { status: 'not ready', reason: 'queue disconnected' },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    return { status: 'ready' };
  }

  @Get('live')
  live() {
    return { status: 'alive', timestamp: new Date().toISOString() };
  }
}
