import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from '../notifications/entities/notification.entity';
import { Message } from '../chat/entities/message.entity';
import { DirectMessage } from '../chat/entities/direct-message.entity';

@Injectable()
export class LifecycleService {
  private readonly logger = new Logger(LifecycleService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
    @InjectRepository(DirectMessage)
    private readonly directMessageRepository: Repository<DirectMessage>,
  ) {}

  async pruneOldNotifications(): Promise<number> {
    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const result = await this.notificationRepository
      .createQueryBuilder()
      .delete()
      .from(Notification)
      .where('created_at < :cutoff', { cutoff })
      .execute();

    const count = result.affected || 0;
    this.logger.log(
      `Pruned ${count} old notifications (cutoff ${cutoff.toISOString()})`,
    );
    return count;
  }

  async archiveOldMessages(): Promise<{ chat: number; dm: number }> {
    const cutoff = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);

    const chatResult = await this.messageRepository
      .createQueryBuilder()
      .update(Message)
      .set({ isArchived: true })
      .where('created_at < :cutoff', { cutoff })
      .execute();

    const dmResult = await this.directMessageRepository
      .createQueryBuilder()
      .update(DirectMessage)
      .set({ isArchived: true })
      .where('created_at < :cutoff', { cutoff })
      .execute();

    const chat = chatResult.affected || 0;
    const dm = dmResult.affected || 0;
    this.logger.log(
      `Archived ${chat} chat messages and ${dm} DMs older than 1 year`,
    );
    return { chat, dm };
  }
}
