import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { databaseConfig } from './config/database.config';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { ErrorLogsModule } from './error-logs/error-logs.module';
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
import { RecurringBookingsModule } from './bookings/recurring-bookings.module';
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
import { ReferralsModule } from './referrals/referrals.module';
import { LoyaltyModule } from './loyalty/loyalty.module';
import { BadgesModule } from './badges/badges.module';
import { InvoicesModule } from './invoices/invoices.module';
import { FollowUpModule } from './followup/followup.module';
import { PortfolioModule } from './portfolio/portfolio.module';
import { TranslationModule } from './chat/translation.module';
import { PricingModule } from './pricing/pricing.module';
import { PlatformFeesModule } from './platform-fees/platform-fees.module';
import { PromotionsModule } from './promotions/promotions.module';
import { PackagesModule } from './packages/packages.module';
import { VerificationVideosModule } from './verification/verification-videos.module';
import { SupportModule } from './support/support.module';
import { UploadsModule } from './uploads/uploads.module';
import { MonitoringModule } from './monitoring/monitoring.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { AdvertisementsModule } from './advertisements/advertisements.module';
import { GrievancesModule } from './grievances/grievances.module';
import { SettingsModule } from './settings/settings.module';
import { ProviderGraceModule } from './provider-grace/provider-grace.module';
import { LocationsModule } from './locations/locations.module';
import { AccountsModule } from './accounts/accounts.module';
import { JobsModule } from './jobs/jobs.module';
import { LifecycleModule } from './lifecycle/lifecycle.module';
import { ReadConnectionModule } from './database/read-connection.module';
import { IdempotencyKey } from './common/entities/idempotency-key.entity';
import { User } from './users/entities/user.entity';
import { CacheService } from './common/cache.service';
import { LifecycleModule } from './lifecycle/lifecycle.module';
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
import { Message } from './chat/entities/message.entity';
import { DirectMessage } from './chat/entities/direct-message.entity';
import { City } from './locations/entities/city.entity';

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
    ScheduleModule.forRoot(),
    AuthModule,
    UsersModule,
    KycModule,
    ServicesModule,
    CommissionsModule,
    AdminModule,
    BookingsModule,
    RecurringBookingsModule,
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
    ReferralsModule,
    LoyaltyModule,
    BadgesModule,
    InvoicesModule,
    FollowUpModule,
    PortfolioModule,
    TranslationModule,
    PricingModule,
    PlatformFeesModule,
    PromotionsModule,
    PackagesModule,
    VerificationVideosModule,
    SupportModule,
    UploadsModule,
    MonitoringModule,
    SubscriptionsModule,
    AdvertisementsModule,
    GrievancesModule,
    SettingsModule,
    ProviderGraceModule,
    ErrorLogsModule,
    LocationsModule,
    AccountsModule,
    JobsModule,
    LifecycleModule,
    ReadConnectionModule,
    LifecycleModule,
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
      Message,
      DirectMessage,
      City,
      IdempotencyKey,
    ]),
  ],
  controllers: [AppController],
  providers: [
    AppService,
    CacheService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerBehindProxyGuard,
    },
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
  ],
})
export class AppModule {}
