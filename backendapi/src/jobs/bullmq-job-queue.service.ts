import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Queue } from 'bullmq';
import { JobType, JobPayload, JobOptions, QueueLike } from './constants';
import { JOB_QUEUE } from './constants.provider';

@Injectable()
export class BullMQJobQueue implements OnModuleInit, QueueLike {
  private readonly logger = new Logger(BullMQJobQueue.name);
  private queue: Queue | null = null;

  constructor() {}

  onModuleInit() {
    try {
      this.queue = new Queue(JOB_QUEUE, {
        connection: {
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379', 10),
        },
        defaultJobOptions: {
          attempts: 5,
          backoff: {
            type: 'exponential',
            delay: 1000,
          },
          removeOnComplete: {
            count: 1000,
            age: 24 * 3600,
          },
          removeOnFail: {
            count: 5000,
            age: 7 * 24 * 3600,
          },
        },
      });
      this.logger.log('BullMQ job queue initialized');
    } catch {
      this.logger.warn('BullMQ initialization failed: queue is unavailable');
      this.queue = null;
    }
  }

  get size(): number {
    return 0;
  }

  async add(
    type: JobType,
    payload: JobPayload,
    options?: JobOptions,
  ): Promise<void> {
    if (!this.queue) {
      this.logger.debug(`BullMQ unavailable, skipping job ${type}`);
      return;
    }
    try {
      const jobId =
        options?.id || `${type}:${payload.idempotencyKey || Date.now()}`;
      await this.queue.add(
        type,
        { type, payload },
        {
          jobId,
          attempts: options?.attempts ?? 5,
          backoff: options?.backoff ?? { type: 'exponential', delay: 1000 },
          delay: options?.delay,
        },
      );
      this.logger.debug(`Enqueued BullMQ job ${jobId} (${type})`);
    } catch (err) {
      this.logger.warn(`Failed to enqueue job ${type}: ${err}`);
    }
  }

  async getWaitingCount(): Promise<number> {
    if (!this.queue) return 0;
    try {
      return await this.queue.getWaitingCount();
    } catch {
      return 0;
    }
  }

  async close(): Promise<void> {
    if (this.queue) {
      await this.queue.close();
      this.queue = null;
    }
  }
}
