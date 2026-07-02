import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import Redis from 'ioredis';

@Controller('health')
export class HealthController {
  private readonly redis: Redis;

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      lazyConnect: true,
    });
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
    try {
      const redisStart = Date.now();
      await this.redis.connect();
      await this.redis.ping();
      await this.redis.quit();
      checks.services.redis = {
        status: 'connected',
        responseTime: Date.now() - redisStart,
      };
    } catch {
      hasError = true;
      checks.services.redis = {
        status: 'disconnected',
        responseTime: 0,
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
      await this.redis.connect();
      await this.redis.ping();
      await this.redis.quit();
      return { status: 'ready' };
    } catch {
      throw new HttpException(
        { status: 'not ready' },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  @Get('live')
  live() {
    return { status: 'alive', timestamp: new Date().toISOString() };
  }
}
