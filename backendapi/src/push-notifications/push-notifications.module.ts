import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PushNotificationsService } from './push-notifications.service';
import { FirebasePushProvider } from './firebase-push.provider';
import { User } from '../users/entities/user.entity';
import { PUSH_NOTIFICATION_PROVIDER } from './push-notifications.constants';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  providers: [
    PushNotificationsService,
    {
      provide: PUSH_NOTIFICATION_PROVIDER,
      useClass: FirebasePushProvider,
    },
  ],
  exports: [PushNotificationsService],
})
export class PushNotificationsModule {}
