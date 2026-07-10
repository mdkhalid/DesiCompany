import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProviderGraceService } from './provider-grace.service';
import { ProviderGraceController } from './provider-grace.controller';
import { Provider } from '../users/entities/provider.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { SettingsModule } from '../settings/settings.module';
import { PushNotificationsModule } from '../push-notifications/push-notifications.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Provider, Booking]),
    SettingsModule,
    PushNotificationsModule,
    NotificationsModule,
  ],
  controllers: [ProviderGraceController],
  providers: [ProviderGraceService],
  exports: [ProviderGraceService],
})
export class ProviderGraceModule {}
