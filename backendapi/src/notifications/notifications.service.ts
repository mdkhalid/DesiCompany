import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from './entities/notification.entity';
import { User } from '../users/entities/user.entity';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
  ) {}

  async create(userId: string, title: string, message: string) {
    const notification = this.notificationRepository.create({
      user: { id: userId } as User,
      title,
      message,
    });
    return this.notificationRepository.save(notification);
  }

  async findByUser(userId: string, page = 1, limit = 20) {
    const [notifications, total] =
      await this.notificationRepository.findAndCount({
        where: { user: { id: userId } },
        order: { createdAt: 'DESC' },
        skip: (page - 1) * limit,
        take: limit,
      });
    return { notifications, total, page, limit };
  }

  async markAsRead(notificationId: string, userId: string) {
    await this.notificationRepository.update(
      { id: notificationId, user: { id: userId } },
      { isRead: true },
    );
    return this.notificationRepository.findOne({
      where: { id: notificationId },
    });
  }

  async markAllAsRead(userId: string) {
    await this.notificationRepository.update(
      { user: { id: userId }, isRead: false },
      { isRead: true },
    );
    return { success: true };
  }

  async getUnreadCount(userId: string) {
    return this.notificationRepository.count({
      where: { user: { id: userId }, isRead: false },
    });
  }
}
