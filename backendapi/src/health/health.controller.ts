import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import Redis from 'ioredis';

@Controller('health')
export class HealthController {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
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

    return { status: 'ready' };
  }

  @Get('live')
  live() {
    return { status: 'alive', timestamp: new Date().toISOString() };
  }
}
