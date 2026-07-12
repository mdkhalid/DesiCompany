import { Injectable, Logger } from '@nestjs/common';
import { JobType, JobPayload, JobOptions } from './constants';

@Injectable()
export class InMemoryJobQueue {
  private readonly logger = new Logger(InMemoryJobQueue.name);
  private queue = new Map<string, JobPayload>();

  async add(
    type: JobType,
    payload: JobPayload,
    options?: JobOptions,
  ): Promise<void> {
    const id = options?.id || `${type}:${Date.now()}:${Math.random()}`;
    this.queue.set(id, { type, payload, options, createdAt: new Date() });
    this.logger.debug(`Enqueued job ${id} (${type})`);
  }

  async processNext(): Promise<void> {
    if (this.queue.size === 0) return;
    const [id, job] = this.queue.entries().next().value;
    this.queue.delete(id);
    this.logger.debug(`Would process job ${id} (${job.type})`);
  }

  get size() {
    return this.queue.size;
  }
}
