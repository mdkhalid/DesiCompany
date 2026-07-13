import { Injectable, Logger, Inject } from '@nestjs/common';
import { JOB_QUEUE } from '../jobs/constants.provider';
import { JobType } from '../jobs/constants';
import type { QueueLike } from '../jobs/constants';

@Injectable()
export class JobQueueService {
  private readonly logger = new Logger(JobQueueService.name);

  constructor(@Inject(JOB_QUEUE) private readonly queue: QueueLike) {}

  async enqueueLoyaltyAward(
    userId: string,
    bookingAmount: number,
    bookingId: string,
  ): Promise<void> {
    const type = JobType.LOYALTY_AWARD;
    try {
      await this.queue.add(type, {
        userId,
        bookingAmount,
        bookingId,
        idempotencyKey: `${bookingId}:${userId}`,
      });
    } catch (err) {
      this.logger.warn(`Enqueue ${type} failed: ${err}`);
    }
  }

  getQueue(): QueueLike {
    return this.queue;
  }
}
