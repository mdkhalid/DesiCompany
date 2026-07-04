import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../common/enums/user-role.enum';
import { NotificationGateway } from '../notifications/notification.gateway';

@Injectable()
export class PushNotificationsService {
  private readonly logger = new Logger(PushNotificationsService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly notificationGateway: NotificationGateway,
  ) {}

  async sendToUser(
    userId: string,
    title: string,
    body: string,
    data?: Record<string, string>,
    recipientRole?: UserRole,
  ) {
    const type = data?.type || 'general';
    this.logger.debug(
      `Sending notification to user ${userId}: ${title} - ${body}`,
    );

    await this.notificationGateway.sendNotification(
      userId,
      title,
      body,
      type,
      data,
      recipientRole,
    );
  }

  async sendToMultipleUsers(
    userIds: string[],
    title: string,
    body: string,
    data?: Record<string, string>,
    recipientRole?: UserRole,
  ) {
    for (const userId of userIds) {
      await this.sendToUser(userId, title, body, data, recipientRole);
    }
  }

  registerToken(userId: string, _fcmToken: string) {
    this.logger.debug(
      `FCM token registration ignored (using WebSocket notifications) for user ${userId}`,
    );
    return { message: 'Using WebSocket notifications' };
  }
}
