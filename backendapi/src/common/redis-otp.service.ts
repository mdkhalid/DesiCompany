import { Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { SettingsService } from '../settings/settings.service';

@Injectable()
export class OtpStoreService {
  private readonly logger = new Logger(OtpStoreService.name);
  private redis: Redis | null = null;
  private readonly fallbackMap = new Map<
    string,
    { code: string; expiresAt: Date }
  >();
  private redisRequired = false;

  constructor(private readonly settingsService: SettingsService) {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.connect();
    this.settingsService
      .isRedisRequired()
      .then((required) => {
        this.redisRequired = required;
        if (required && !this.redis) {
          this.logger.error(
            'Redis is REQUIRED but unavailable — OTP writes will fail hard',
          );
        }
      })
      .catch(() => {});
  }

  private async connect(): Promise<void> {
    try {
      this.redis = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        retryStrategy: () => null,
      });
      this.redis.on('error', () => {
        this.logger.warn('Redis connection error — OTPService disconnected');
        this.redis = null;
      });
      await this.redis.connect();
      this.logger.log('Redis connected for OTP store');
    } catch {
      this.logger.warn('Redis unavailable for OTP store');
      this.redis = null;
    }
  }

  async set(phone: string, code: string): Promise<void> {
    if (!this.redis) {
      if (this.redisRequired) {
        throw new Error('Redis unavailable');
      }
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
      this.fallbackMap.set(phone, { code, expiresAt });
      return;
    }
    await this.redis.setex(`otp:${phone}`, 300, code);
  }

  async get(phone: string): Promise<string | null> {
    if (!this.redis) {
      if (this.redisRequired) {
        throw new Error('Redis unavailable');
      }
      const record = this.fallbackMap.get(phone);
      if (!record) return null;
      if (record.expiresAt < new Date()) {
        this.fallbackMap.delete(phone);
        return null;
      }
      return record.code;
    }
    return this.redis.get(`otp:${phone}`);
  }

  async delete(phone: string): Promise<void> {
    if (!this.redis && this.redisRequired) {
      throw new Error('Redis unavailable');
    }
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
