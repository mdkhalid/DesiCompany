import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Payment } from './entities/payment.entity';
import { Transaction } from './entities/transaction.entity';
import { Wallet } from './entities/wallet.entity';
import { PaymentGatewayConfig } from './entities/payment-gateway-config.entity';
import { WebhookEvent } from './entities/webhook-event.entity';
import { PaymentGatewayFactory } from './gateways/payment-gateway.factory';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { WebhookService } from './webhooks.service';
import { WebhooksController } from './webhooks.controller';
import { WalletsService } from './wallets.service';
import { WalletsController } from './wallets.controller';
import { LedgerService } from './ledger.service';
import { SoftBlockService } from './soft-block.service';
import { BookingsModule } from '../bookings/bookings.module';
import { CommissionsModule } from '../commissions/commissions.module';
import { PlatformFeesModule } from '../platform-fees/platform-fees.module';
import { AccountsModule } from '../accounts/accounts.module';
import { CommonModule } from '../common/common.module';
import { User } from '../users/entities/user.entity';
import { Provider } from '../users/entities/provider.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { ProviderSubscription } from '../platform-fees/entities/provider-subscription.entity';
import { ProviderSubscriptionPlan } from '../platform-fees/entities/provider-subscription-plan.entity';
import { PlatformFeeConfig } from '../platform-fees/entities/platform-fee-config.entity';
import { CustomerMembership } from '../platform-fees/entities/customer-membership.entity';
import { CustomerMembershipPlan } from '../platform-fees/entities/customer-membership-plan.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Payment,
      Transaction,
      Wallet,
      PaymentGatewayConfig,
      WebhookEvent,
      User,
      Provider,
      Booking,
      ProviderSubscription,
      ProviderSubscriptionPlan,
      PlatformFeeConfig,
      CustomerMembership,
      CustomerMembershipPlan,
    ]),
    BookingsModule,
    CommissionsModule,
    PlatformFeesModule,
    AccountsModule,
    CommonModule,
  ],
  controllers: [PaymentsController, WebhooksController, WalletsController],
  providers: [
    PaymentGatewayFactory,
    PaymentsService,
    WebhookService,
    WalletsService,
    LedgerService,
    SoftBlockService,
  ],
  exports: [
    PaymentGatewayFactory,
    PaymentsService,
    WalletsService,
    LedgerService,
    SoftBlockService,
    TypeOrmModule.forFeature([
      Payment,
      Transaction,
      Wallet,
      PaymentGatewayConfig,
      WebhookEvent,
    ]),
  ],
})
export class PaymentsModule {}
