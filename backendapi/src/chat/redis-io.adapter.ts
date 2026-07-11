import { IoAdapter } from '@nestjs/platform-socket.io';
import { INestApplication } from '@nestjs/common';
import { createAdapter } from '@socket.io/redis-adapter';
import { ServerOptions } from 'socket.io';
import { Redis } from 'ioredis';

/**
 * Redis-backed WebSocket adapter for horizontal scaling.
 * Falls back to in-memory adapter if Redis is unavailable.
 */
export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor: any = null;

  constructor(app: INestApplication) {
    super(app);
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
            console.warn('[RedisIoAdapter] Redis connection failed, falling back to in-memory adapter');
            return null; // Stop retrying
          }
          return Math.min(times * 50, 2000);
        },
      });

      const subClient = pubClient.duplicate();

      await Promise.all([pubClient.connect(), subClient.connect()]);

      this.adapterConstructor = createAdapter(pubClient, subClient);
      console.log('[RedisIoAdapter] Connected to Redis successfully');
    } catch (error) {
      console.warn('[RedisIoAdapter] Redis unavailable, using in-memory adapter:', error.message);
      this.adapterConstructor = null;
    }
  }

  createIOServer(port: number, options?: ServerOptions): any {
    const server = super.createIOServer(port, options);

    if (this.adapterConstructor) {
      server.adapter(this.adapterConstructor);
    }

    return server;
  }
}
