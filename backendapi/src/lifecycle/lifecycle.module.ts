import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LifecycleService } from './lifecycle.service';
import { Notification } from '../notifications/entities/notification.entity';
import { Message } from '../chat/entities/message.entity';
import { DirectMessage } from '../chat/entities/direct-message.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Notification, Message, DirectMessage])],
  providers: [LifecycleService],
  exports: [LifecycleService],
})
export class LifecycleModule {}
