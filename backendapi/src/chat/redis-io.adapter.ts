import { IoAdapter } from '@nestjs/platform-socket.io';
import { INestApplication } from '@nestjs/common';
import { createAdapter } from '@socket.io/redis-adapter';
import { ServerOptions } from 'socket.io';
import { Redis } from 'ioredis';
import { Logger } from '@nestjs/common';

/**
 * Redis-backed WebSocket adapter for horizontal scaling.
 * In production with REDIS_REQUIRED, fails startup if Redis is unavailable.
 */
export class RedisIoAdapter extends IoAdapter {
  private readonly logger = new Logger(RedisIoAdapter.name);
  private adapterConstructor: any = null;
  private readonly redisRequired: boolean;

  constructor(app: INestApplication, redisRequired = false) {
    super(app);
    this.redisRequired = redisRequired;
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.connectToRedis();
  }

  private async connectToRedis(): Promise<void> {
    try {
      const pubClient = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        lazyConnect: true,
        retryStrategy: (times) => {
          if (times > 3) {
            this.logger.warn(
              '[RedisIoAdapter] Redis connection failed after retries',
            );
            return null;
          }
          return Math.min(times * 50, 2000);
        },
      });

      const subClient = pubClient.duplicate();

      await Promise.all([pubClient.connect(), subClient.connect()]);

      this.adapterConstructor = createAdapter(pubClient, subClient) as any;
      this.logger.log('[RedisIoAdapter] Connected to Redis successfully');
    } catch {
      this.adapterConstructor = null;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      this.logger.warn(
        '[RedisIoAdapter] Redis unavailable; cross-instance chat disabled',
      );
      if (this.redisRequired) {
        throw new Error(
          'Redis required in production but unavailable — refusing to start without it',
        );
      }
    }
  }

  createIOServer(port: number, options?: ServerOptions): any {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const server = super.createIOServer(port, options);

    if (this.adapterConstructor) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      server.adapter(this.adapterConstructor);
      return server;
    }

    if (this.redisRequired) {
      throw new Error(
        'Redis required but unavailable — socket server will not start',
      );
    }

    this.logger.warn(
      '[RedisIoAdapter] Running without Redis adapter — chat is single-instance only',
    );
    return server;
  }
}
