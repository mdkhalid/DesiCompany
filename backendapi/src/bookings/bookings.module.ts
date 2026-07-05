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
import { ProviderAvailability } from '../services/entities/provider-availability.entity';
import { ProviderDateOverride } from '../services/entities/provider-date-override.entity';
import { ProviderBusySlot } from '../services/entities/provider-busy-slot.entity';
import { Message } from '../chat/entities/message.entity';
import { User } from '../users/entities/user.entity';
import { JobRequest } from '../quotes/entities/job-request.entity';
import { ChatModule } from '../chat/chat.module';
import { CommissionsModule } from '../commissions/commissions.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PushNotificationsModule } from '../push-notifications/push-notifications.module';
import { LoyaltyModule } from '../loyalty/loyalty.module';
import { PlatformFeesModule } from '../platform-fees/platform-fees.module';

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
      ProviderAvailability,
      ProviderDateOverride,
      ProviderBusySlot,
      Message,
      User,
      JobRequest,
    ]),
    PlatformFeesModule,
    CommissionsModule,
    NotificationsModule,
    PushNotificationsModule,
    LoyaltyModule,
    ChatModule,
  ],
  controllers: [
    BookingsController,
    BookingRemindersController,
    BookingPhotosController,
  ],
  providers: [BookingsService, BookingRemindersService, BookingPhotosService],
  exports: [BookingsService, BookingRemindersService, BookingPhotosService],
})
export class BookingsModule {}
