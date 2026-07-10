import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
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
    type?: string,
    metadata?: Record<string, unknown>,
    recipientRole?: UserRole,
  ): Promise<Notification> {
    const notification = this.notificationRepository.create({
      user: { id: userId } as User,
      title,
      message,
      type,
      metadata,
      recipientRole,
    });
    return this.notificationRepository.save(notification);
  }

  async findByUser(
    userId: string,
    page = 1,
    limit = 20,
    activeRole?: UserRole,
  ): Promise<{
    notifications: Notification[];
    total: number;
    page: number;
    limit: number;
  }> {
    // For dual-role users, filter by the active role so they only see
    // notifications relevant to their current role context.
    // Notifications without a recipientRole (legacy data or broadcasts)
    // are shown to all roles.
    const where: Record<string, unknown> = { user: { id: userId } };
    if (activeRole) {
      where.recipientRole = activeRole;
    }

    const [notifications, total] =
      await this.notificationRepository.findAndCount({
        where,
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
    const notification = await this.notificationRepository.findOne({
      where: { id: notificationId, user: { id: userId } },
    });
    if (!notification) return null;

    notification.isRead = true;
    await this.notificationRepository.save(notification);

    // Also mark other unread notifications for the same conversation as read
    const meta = notification.metadata as Record<string, unknown> | undefined;
    const bookingId = meta?.bookingId as string | undefined;
    const roomId = meta?.roomId as string | undefined;

    if (bookingId || roomId) {
      const unread = await this.notificationRepository.find({
        where: { user: { id: userId }, isRead: false },
        select: { id: true, metadata: true },
      });
      const relatedIds = unread
        .filter((n) => {
          const m = n.metadata as Record<string, unknown> | undefined;
          if (bookingId && m?.bookingId === bookingId) return true;
          if (roomId && m?.roomId === roomId) return true;
          return false;
        })
        .map((n) => n.id);
      if (relatedIds.length > 0) {
        await this.notificationRepository.update(
          { id: In(relatedIds) },
          { isRead: true },
        );
      }
    }

    return notification;
  }

  async markAllAsRead(
    userId: string,
    activeRole?: UserRole,
  ): Promise<{ success: boolean }> {
    const where: Record<string, unknown> = {
      user: { id: userId },
      isRead: false,
    };
    if (activeRole) {
      where.recipientRole = activeRole;
    }
    await this.notificationRepository.update(where, { isRead: true });
    return { success: true };
  }

  async getUnreadCount(userId: string, activeRole?: UserRole): Promise<number> {
    const where: Record<string, unknown> = {
      user: { id: userId },
      isRead: false,
    };
    if (activeRole) {
      where.recipientRole = activeRole;
    }
    return this.notificationRepository.count({ where });
  }

  async markBookingNotificationsAsRead(
    userId: string,
    bookingId: string,
  ): Promise<void> {
    const unread = await this.notificationRepository.find({
      where: { user: { id: userId }, isRead: false },
      select: { id: true, metadata: true },
    });
    const relatedIds = unread
      .filter(
        (n) =>
          (n.metadata as Record<string, unknown> | undefined)?.bookingId ===
          bookingId,
      )
      .map((n) => n.id);
    if (relatedIds.length > 0) {
      await this.notificationRepository.update(
        { id: In(relatedIds) },
        { isRead: true },
      );
    }
  }

  async broadcast(
    title: string,
    message: string,
    role?: UserRole,
    type?: string,
    metadata?: Record<string, unknown>,
  ): Promise<{ message: string; count: number }> {
    const where: { role?: UserRole } = {};
    if (role) {
      where.role = role;
    }

    const users = await this.userRepository.find({
      where,
      select: { id: true },
    });

    const notifications = users.map((user) =>
      this.notificationRepository.create({
        user: { id: user.id } as User,
        title,
        message,
        type,
        metadata,
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
