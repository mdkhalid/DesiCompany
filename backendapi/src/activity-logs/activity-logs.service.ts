import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActivityLog } from './entities/activity-log.entity';
import { User } from '../users/entities/user.entity';

@Injectable()
export class ActivityLogsService {
  constructor(
    @InjectRepository(ActivityLog)
    private readonly activityLogRepository: Repository<ActivityLog>,
  ) {}

  async log(
    action: string,
    entityType: string,
    entityId?: string,
    actorId?: string,
    metadata?: Record<string, any>,
  ) {
    const log = this.activityLogRepository.create({
      action,
      entityType,
      entityId,
      actor: actorId ? ({ id: actorId } as User) : undefined,
      metadata,
    });
    return this.activityLogRepository.save(log);
  }

  async findAll(page = 1, limit = 50) {
    const [logs, total] = await this.activityLogRepository.findAndCount({
      relations: { actor: true },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { logs, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findByEntity(entityType: string, entityId: string) {
    return this.activityLogRepository.find({
      where: { entityType, entityId },
      relations: { actor: true },
      order: { createdAt: 'DESC' },
    });
  }
}
