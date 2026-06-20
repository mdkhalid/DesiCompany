import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminPaymentGatewaysController } from './admin-payment-gateways.controller';
import { AdminPaymentGatewaysService } from './admin-payment-gateways.service';
import { AdminRefundsController } from './admin-refunds.controller';
import { AdminRefundsService } from './admin-refunds.service';
import { AdminConfigController } from './admin-config.controller';
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
    PaymentsModule,
    FeedbacksModule,
    AuthModule,
    ActivityLogsModule,
  ],
  controllers: [
    AdminController,
    AdminPaymentGatewaysController,
    AdminRefundsController,
    AdminConfigController,
  ],
  providers: [AdminService, AdminPaymentGatewaysService, AdminRefundsService],
})
export class AdminModule {}
