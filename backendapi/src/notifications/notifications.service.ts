import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from './entities/notification.entity';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../common/enums/user-role.enum';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async create(
    userId: string,
    title: string,
    message: string,
  ): Promise<Notification> {
    const notification = this.notificationRepository.create({
      user: { id: userId } as User,
      title,
      message,
    });
    return this.notificationRepository.save(notification);
  }

  async findByUser(
    userId: string,
    page = 1,
    limit = 20,
  ): Promise<{
    notifications: Notification[];
    total: number;
    page: number;
    limit: number;
  }> {
    const [notifications, total] =
      await this.notificationRepository.findAndCount({
        where: { user: { id: userId } },
        order: { createdAt: 'DESC' },
        skip: (page - 1) * limit,
        take: limit,
      });
    return { notifications, total, page, limit };
  }

  async markAsRead(
    notificationId: string,
    userId: string,
  ): Promise<Notification | null> {
    await this.notificationRepository.update(
      { id: notificationId, user: { id: userId } },
      { isRead: true },
    );
    return this.notificationRepository.findOne({
      where: { id: notificationId },
    });
  }

  async markAllAsRead(userId: string): Promise<{ success: boolean }> {
    await this.notificationRepository.update(
      { user: { id: userId }, isRead: false },
      { isRead: true },
    );
    return { success: true };
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.notificationRepository.count({
      where: { user: { id: userId }, isRead: false },
    });
  }

  async broadcast(
    title: string,
    message: string,
    role?: UserRole,
  ): Promise<{ message: string; count: number }> {
    // Find target users
    const where: { role?: UserRole } = {};
    if (role) {
      where.role = role;
    }

    const users = await this.userRepository.find({
      where,
      select: { id: true },
    });

    // Batch create notifications
    const notifications = users.map((user) =>
      this.notificationRepository.create({
        user: { id: user.id } as User,
        title,
        message,
      }),
    );

    if (notifications.length > 0) {
      await this.notificationRepository.save(notifications);
    }

    return {
      message: `Broadcast sent to ${notifications.length} users`,
      count: notifications.length,
    };
  }
}
