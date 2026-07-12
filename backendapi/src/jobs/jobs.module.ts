import { Module } from '@nestjs/common';
import { BullMQJobQueue } from './bullmq-job-queue.service';
import { InMemoryJobQueue } from './in-memory-job-queue.service';
import { JOB_QUEUE } from './constants.provider';

export const isWorker = process.env.WORKER_MODE === 'true';
export const isRedisRequired = process.env.REDIS_REQUIRED === 'true';

@Module({
  providers: [
    {
      provide: JOB_QUEUE,
      useFactory: () => {
        if (isWorker && isRedisRequired) {
          return new BullMQJobQueue();
        }
        return new InMemoryJobQueue();
      },
    },
    BullMQJobQueue,
    InMemoryJobQueue,
  ],
  exports: [JOB_QUEUE],
})
export class JobsModule {}
