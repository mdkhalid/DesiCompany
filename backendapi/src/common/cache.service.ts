import { Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';

export interface CacheOptions {
  ttlSeconds?: number;
}

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private redis: Redis | null = null;

  constructor() {
    try {
      this.redis = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        retryStrategy: () => null,
      });
      this.redis.on('error', () => {
        this.logger.warn('CacheService disconnected');
        this.redis = null;
      });
      this.redis.connect().catch(() => {
        this.logger.warn('CacheService unavailable');
        this.redis = null;
      });
    } catch {
      this.logger.warn('CacheService unavailable');
      this.redis = null;
    }
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.redis) return null;
    try {
      const raw = await this.redis.get(key);
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async set(key: string, value: any, ttlSeconds = 60): Promise<void> {
    if (!this.redis) return;
    try {
      const serialized = JSON.stringify(value);
      if (ttlSeconds > 0) {
        await this.redis.setex(key, ttlSeconds, serialized);
      } else {
        await this.redis.set(key, serialized);
      }
    } catch {
      // best-effort
    }
  }

  async del(key: string): Promise<void> {
    if (!this.redis) return;
    try {
      await this.redis.del(key);
    } catch {
      // best-effort
    }
  }

  async invalidatePattern(pattern: string): Promise<void> {
    if (!this.redis) return;
    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch {
      // best-effort
    }
  }

  isConnected(): boolean {
    return this.redis !== null;
  }
}
