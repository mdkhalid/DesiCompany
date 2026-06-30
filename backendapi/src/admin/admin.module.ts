import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AnalyticsService } from './analytics.service';
import { AdminPaymentGatewaysController } from './admin-payment-gateways.controller';
import { AdminPaymentGatewaysService } from './admin-payment-gateways.service';
import { AdminRefundsController } from './admin-refunds.controller';
import { AdminRefundsService } from './admin-refunds.service';
import { AdminConfigController } from './admin-config.controller';
import { AdminPlatformFeesController } from './admin-platform-fees.controller';
import { AdminErrorLogsController } from './admin-error-logs.controller';
import { User } from '../users/entities/user.entity';
import { Customer } from '../users/entities/customer.entity';
import { Provider } from '../users/entities/provider.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { Payment } from '../payments/entities/payment.entity';
import { Wallet } from '../payments/entities/wallet.entity';
import { Transaction } from '../payments/entities/transaction.entity';
import { PaymentGatewayConfig } from '../payments/entities/payment-gateway-config.entity';
import { Review } from '../reviews/entities/review.entity';
import { CommissionConfig } from '../commissions/entities/commission-config.entity';
import { PaymentsModule } from '../payments/payments.module';
import { FeedbacksModule } from '../feedbacks/feedbacks.module';
import { AuthModule } from '../auth/auth.module';
import { ActivityLogsModule } from '../activity-logs/activity-logs.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ReviewsModule } from '../reviews/reviews.module';
import { PlatformFeesModule } from '../platform-fees/platform-fees.module';
import { ErrorLogsModule } from '../error-logs/error-logs.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Customer,
      Provider,
      Booking,
      Payment,
      Wallet,
      Transaction,
      PaymentGatewayConfig,
      Review,
      CommissionConfig,
    ]),
    PlatformFeesModule,
    PaymentsModule,
    FeedbacksModule,
    AuthModule,
    ActivityLogsModule,
    NotificationsModule,
    ReviewsModule,
    ErrorLogsModule,
  ],
  controllers: [
    AdminController,
    AdminPaymentGatewaysController,
    AdminRefundsController,
    AdminConfigController,
    AdminPlatformFeesController,
    AdminErrorLogsController,
  ],
  providers: [
    AdminService,
    AnalyticsService,
    AdminPaymentGatewaysService,
    AdminRefundsService,
  ],
})
export class AdminModule {}
