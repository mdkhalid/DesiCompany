import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Booking } from '../bookings/entities/booking.entity';
import { Customer } from '../users/entities/customer.entity';
import { Provider } from '../users/entities/provider.entity';
import { User } from '../users/entities/user.entity';
import { CustomerFeedbacksController } from './customer-feedbacks.controller';
import { CustomerFeedbacksService } from './customer-feedbacks.service';
import { CustomerFeedback } from './entities/customer-feedback.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CustomerFeedback,
      Booking,
      Provider,
      Customer,
      User,
    ]),
  ],
  controllers: [CustomerFeedbacksController],
  providers: [CustomerFeedbacksService],
  exports: [CustomerFeedbacksService],
})
export class FeedbacksModule {}
