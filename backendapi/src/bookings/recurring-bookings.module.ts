import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RecurringBookingsController } from './recurring-bookings.controller';
import { RecurringBookingsService } from './recurring-bookings.service';
import { RecurringBooking } from './entities/recurring-booking.entity';
import { Booking } from './entities/booking.entity';
import { Customer } from '../users/entities/customer.entity';
import { Provider } from '../users/entities/provider.entity';
import { ProviderService } from '../services/entities/provider-service.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      RecurringBooking,
      Booking,
      Customer,
      Provider,
      ProviderService,
    ]),
  ],
  controllers: [RecurringBookingsController],
  providers: [RecurringBookingsService],
  exports: [RecurringBookingsService],
})
export class RecurringBookingsModule {}
