import { Injectable, Logger, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { PUSH_NOTIFICATION_PROVIDER } from './push-notifications.module';

@Injectable()
export class PushNotificationsService {
  private readonly logger = new Logger(PushNotificationsService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @Inject(PUSH_NOTIFICATION_PROVIDER)
    private readonly pushProvider: { send(payload: { token: string; title: string; body: string; data?: Record<string, string> }): Promise<void> },
  ) {}

  async sendToUser(
    userId: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user?.fcmToken) {
      this.logger.debug(`No FCM token for user ${userId}, skipping push`);
      return;
    }

    try {
      await this.pushProvider.send({
        token: user.fcmToken,
        title,
        body,
        data,
      });
    } catch (error) {
      this.logger.error(`Failed to send push to user ${userId}: ${error}`);
    }
  }

  async sendToMultipleUsers(
    userIds: string[],
    title: string,
    body: string,
    data?: Record<string, string>,
  ) {
    const users = await this.userRepository
      .createQueryBuilder('user')
      .where('user.id IN (:...userIds)', { userIds })
      .andWhere('user.fcmToken IS NOT NULL')
      .getMany();

    for (const user of users) {
      try {
        await this.pushProvider.send({
          token: user.fcmToken!,
          title,
          body,
          data,
        });
      } catch (error) {
        this.logger.error(`Failed to send push to user ${user.id}: ${error}`);
      }
    }
  }

  async registerToken(userId: string, fcmToken: string) {
    await this.userRepository.update(userId, { fcmToken });
    return { message: 'FCM token registered' };
  }
}
