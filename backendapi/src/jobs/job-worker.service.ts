import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { Worker } from 'bullmq';
import { JobType } from './constants';
import { ModulesContainer } from '@nestjs/core';
import { JobHandler } from './job-processor.service';

@Injectable()
export class JobWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(JobWorker.name);
  private worker: Worker | null = null;
  private handlers = new Map<JobType, JobHandler>();

  constructor(private readonly modulesContainer: ModulesContainer) {}

  onModuleInit() {
    this.collectHandlers();
    if (process.env.WORKER_MODE !== 'true') return;

    try {
      this.worker = new Worker(
        'desicompany-jobs',
        async (job) => {
          const handler = this.handlers.get(job.name as JobType);
          if (!handler) return;
          try {
            await handler(job.data?.payload || job.data);
          } catch (err) {
            this.logger.warn(`Job ${job.id} (${job.name}) failed: ${err}`);
            throw err;
          }
        },
        {
          concurrency: 5,
          connection: {
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379', 10),
          },
        },
      );

      this.worker.on('error', (err) => {
        this.logger.warn(`Worker error: ${err}`);
      });

      this.logger.log('JobWorker started');
    } catch (err) {
      this.logger.warn('JobWorker failed to start');
    }
  }

  onModuleDestroy() {
    if (this.worker) {
      this.worker.close().catch(() => {});
      this.worker = null;
    }
  }

  private collectHandlers() {
    for (const [, moduleRef] of this.modulesContainer) {
      const instance = moduleRef.instance as any;
      if (!instance || typeof instance.handleJob !== 'function') {
        continue;
      }
      const type = instance.handledJobType;
      if (type) {
        this.handlers.set(type, instance.handleJob.bind(instance));
      }
    }
  }
}
