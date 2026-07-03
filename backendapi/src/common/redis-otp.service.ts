import { Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class OtpStoreService {
  private readonly logger = new Logger(OtpStoreService.name);
  private redis: Redis | null = null;
  private readonly fallbackMap = new Map<
    string,
    { code: string; expiresAt: Date }
  >();

  constructor() {
    try {
      this.redis = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        retryStrategy: () => null,
      });
      this.redis.connect().catch(() => {
        this.logger.warn(
          'Redis unavailable — OTP storage falling back to in-memory',
        );
        this.redis = null;
      });
    } catch {
      this.logger.warn(
        'Redis unavailable — OTP storage falling back to in-memory',
      );
      this.redis = null;
    }
  }

  async set(phone: string, code: string): Promise<void> {
    if (this.redis) {
      await this.redis.setex(`otp:${phone}`, 300, code);
    } else {
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
      this.fallbackMap.set(phone, { code, expiresAt });
    }
  }

  async get(phone: string): Promise<string | null> {
    if (this.redis) {
      return this.redis.get(`otp:${phone}`);
    }
    const record = this.fallbackMap.get(phone);
    if (!record) return null;
    if (record.expiresAt < new Date()) {
      this.fallbackMap.delete(phone);
      return null;
    }
    return record.code;
  }

  async delete(phone: string): Promise<void> {
    if (this.redis) {
      await this.redis.del(`otp:${phone}`);
    } else {
      this.fallbackMap.delete(phone);
    }
  }

  isConnected(): boolean {
    return this.redis !== null;
  }
}
