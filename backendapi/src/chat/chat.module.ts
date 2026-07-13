import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatGateway } from './chat.gateway';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { PresenceService } from './presence.service';
import { TranslationModule } from './translation.module';
import { Message } from './entities/message.entity';
import { DirectMessage } from './entities/direct-message.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { AuthModule } from '../auth/auth.module';
import { User } from '../users/entities/user.entity';
import { Provider } from '../users/entities/provider.entity';
import { Customer } from '../users/entities/customer.entity';
import { PushNotificationsModule } from '../push-notifications/push-notifications.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { MonitoringModule } from '../monitoring/monitoring.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Message,
      DirectMessage,
      Booking,
      User,
      Provider,
      Customer,
    ]),
    AuthModule,
    TranslationModule,
    PushNotificationsModule,
    NotificationsModule,
    MonitoringModule,
  ],
  providers: [ChatGateway, ChatService, PresenceService],
  controllers: [ChatController],
  exports: [ChatGateway, ChatService, PresenceService],
})
export class ChatModule {}
