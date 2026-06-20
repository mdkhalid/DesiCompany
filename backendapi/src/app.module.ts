import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { databaseConfig } from './config/database.config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { ThrottlerBehindProxyGuard } from './common/guards/throttler-behind-proxy.guard';
import { UsersModule } from './users/users.module';
import { KycModule } from './kyc/kyc.module';
import { ServicesModule } from './services/services.module';
import { CommissionsModule } from './commissions/commissions.module';
import { AdminModule } from './admin/admin.module';
import { BookingsModule } from './bookings/bookings.module';
import { PaymentsModule } from './payments/payments.module';
import { ReviewsModule } from './reviews/reviews.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ChatModule } from './chat/chat.module';
import { FeedbacksModule } from './feedbacks/feedbacks.module';
import { QuotesModule } from './quotes/quotes.module';
import { DisputesModule } from './disputes/disputes.module';
import { ActivityLogsModule } from './activity-logs/activity-logs.module';
import { PushNotificationsModule } from './push-notifications/push-notifications.module';
import { SmsModule } from './sms/sms.module';
import { HealthModule } from './health/health.module';
import { User } from './users/entities/user.entity';
import { Customer } from './users/entities/customer.entity';
import { Provider } from './users/entities/provider.entity';
import { KycDocument } from './kyc/entities/kyc-document.entity';
import { ServiceCategory } from './services/entities/service-category.entity';
import { Booking } from './bookings/entities/booking.entity';
import { BookingCharge } from './bookings/entities/booking-charge.entity';
import { Payment } from './payments/entities/payment.entity';
import { Wallet } from './payments/entities/wallet.entity';
import { Transaction } from './payments/entities/transaction.entity';
import { CommissionConfig } from './commissions/entities/commission-config.entity';
import { Review } from './reviews/entities/review.entity';
import { Notification } from './notifications/entities/notification.entity';
import { CustomerFeedback } from './feedbacks/entities/customer-feedback.entity';
import { Dispute } from './disputes/entities/dispute.entity';
import { ActivityLog } from './activity-logs/entities/activity-log.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRoot(databaseConfig()),
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60000,
        limit: 30,
      },
    ]),
    AuthModule,
    UsersModule,
    KycModule,
    ServicesModule,
    CommissionsModule,
    AdminModule,
    BookingsModule,
    PaymentsModule,
    ReviewsModule,
    NotificationsModule,
    ChatModule,
    FeedbacksModule,
    QuotesModule,
    DisputesModule,
    ActivityLogsModule,
    PushNotificationsModule,
    SmsModule,
    HealthModule,
    TypeOrmModule.forFeature([
      User,
      Customer,
      Provider,
      KycDocument,
      ServiceCategory,
      Booking,
      BookingCharge,
      Payment,
      Wallet,
      Transaction,
      CommissionConfig,
      Review,
      Notification,
      CustomerFeedback,
      Dispute,
      ActivityLog,
    ]),
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerBehindProxyGuard,
    },
  ],
})
export class AppModule {}
