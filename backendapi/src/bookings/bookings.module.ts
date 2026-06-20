import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { BookingRemindersController } from './booking-reminders.controller';
import { BookingRemindersService } from './booking-reminders.service';
import { BookingPhotosController } from './booking-photos.controller';
import { BookingPhotosService } from './booking-photos.service';
import { Booking } from './entities/booking.entity';
import { BookingCharge } from './entities/booking-charge.entity';
import { BookingPhoto } from './entities/booking-photo.entity';
import { BookingServiceItem } from './entities/booking-service-item.entity';
import { Customer } from '../users/entities/customer.entity';
import { Provider } from '../users/entities/provider.entity';
import { ProviderService } from '../services/entities/provider-service.entity';
import { CommissionsModule } from '../commissions/commissions.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PushNotificationsModule } from '../push-notifications/push-notifications.module';
import { LoyaltyModule } from '../loyalty/loyalty.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Booking,
      BookingCharge,
      BookingPhoto,
      BookingServiceItem,
      Customer,
      Provider,
      ProviderService,
    ]),
    CommissionsModule,
    NotificationsModule,
    PushNotificationsModule,
    LoyaltyModule,
  ],
  controllers: [BookingsController, BookingRemindersController, BookingPhotosController],
  providers: [BookingsService, BookingRemindersService, BookingPhotosService],
  exports: [BookingsService, BookingRemindersService, BookingPhotosService],
})
export class BookingsModule {}
