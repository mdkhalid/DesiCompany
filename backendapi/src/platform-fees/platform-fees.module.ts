import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlatformFeeConfig } from './entities/platform-fee-config.entity';
import { ProviderSubscriptionPlan } from './entities/provider-subscription-plan.entity';
import { ProviderSubscription } from './entities/provider-subscription.entity';
import { PromoCode } from './entities/promo-code.entity';
import { PromoCodeUsage } from './entities/promo-code-usage.entity';
import { CustomerMembershipPlan } from './entities/customer-membership-plan.entity';
import { CustomerMembership } from './entities/customer-membership.entity';
import { PlatformFeesService } from './platform-fees.service';
import { Provider } from '../users/entities/provider.entity';
import { User } from '../users/entities/user.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { ActivityLogsModule } from '../activity-logs/activity-logs.module';
import { PublicFeesController } from './public-fees.controller';
import { SubscriptionCronService } from './subscription-cron.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PlatformFeeConfig,
      ProviderSubscriptionPlan,
      ProviderSubscription,
      PromoCode,
      PromoCodeUsage,
      CustomerMembershipPlan,
      CustomerMembership,
      Provider,
      User,
      Booking,
    ]),
    ActivityLogsModule,
  ],
  controllers: [PublicFeesController],
  providers: [PlatformFeesService, SubscriptionCronService],
  exports: [PlatformFeesService],
})
export class PlatformFeesModule {}
