import { Injectable, Logger } from '@nestjs/common';
import { JobType, JobPayload, JobOptions, QueueLike } from './constants';

@Injectable()
export class InMemoryJobQueue implements QueueLike {
  private readonly logger = new Logger(InMemoryJobQueue.name);
  private queue = new Map<string, JobPayload>();

  get size(): number {
    return this.queue.size;
  }

  add(type: JobType, payload: JobPayload, options?: JobOptions): void {
    const id = options?.id || `${type}:${Date.now()}:${Math.random()}`;
    this.queue.set(id, {
      type,
      payload,
      options,
      createdAt: new Date(),
    });
    this.logger.debug(`Enqueued job ${id} (${type})`);
  }

  processNext(): void {
    if (this.queue.size === 0) return;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const [id, job] = this.queue.entries().next().value;
    this.queue.delete(id);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const jobType = job.type as JobType;
    this.logger.debug(`Would process job ${id} (${jobType})`);
  }

  getWaitingCount(): number {
    return this.queue.size;
  }

  close(): void {
    this.queue.clear();
  }
}
