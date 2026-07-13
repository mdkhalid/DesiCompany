import { Module } from '@nestjs/common';
import { GdprController } from './gdpr.controller';
import { UsersService } from '../users/users.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { Customer } from '../users/entities/customer.entity';
import { Provider } from '../users/entities/provider.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { Payment } from '../payments/entities/payment.entity';
import { Review } from '../reviews/entities/review.entity';
import { Notification } from '../notifications/entities/notification.entity';
import { Message } from '../chat/entities/message.entity';
import { DirectMessage } from '../chat/entities/direct-message.entity';
import { ActivityLog } from '../activity-logs/entities/activity-log.entity';
import { Dispute } from '../disputes/entities/dispute.entity';
import { CustomerFeedback } from '../feedbacks/entities/customer-feedback.entity';
import { KycDocument } from '../kyc/entities/kyc-document.entity';
import { ActivityLogsModule } from '../activity-logs/activity-logs.module';

@Module({
  imports: [
    ActivityLogsModule,
    TypeOrmModule.forFeature([
      User,
      Customer,
      Provider,
      Booking,
      Payment,
      Review,
      Notification,
      Message,
      DirectMessage,
      ActivityLog,
      Dispute,
      CustomerFeedback,
      KycDocument,
    ]),
  ],
  controllers: [GdprController],
  providers: [UsersService],
})
export class GdprModule {}
