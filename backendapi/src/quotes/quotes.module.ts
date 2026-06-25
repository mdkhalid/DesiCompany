import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Booking } from '../bookings/entities/booking.entity';
import { ServiceCategory } from '../services/entities/service-category.entity';
import { ProviderService } from '../services/entities/provider-service.entity';
import { Customer } from '../users/entities/customer.entity';
import { Provider } from '../users/entities/provider.entity';
import { User } from '../users/entities/user.entity';
import { Message } from '../chat/entities/message.entity';
import { ChatModule } from '../chat/chat.module';
import { JobRequest } from './entities/job-request.entity';
import { Quote } from './entities/quote.entity';
import { QuotesController } from './quotes.controller';
import { QuotesService } from './quotes.service';
import { PlatformFeesModule } from '../platform-fees/platform-fees.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      JobRequest,
      Quote,
      Customer,
      Provider,
      ServiceCategory,
      ProviderService,
      Booking,
      User,
      Message,
    ]),
    PlatformFeesModule,
    ChatModule,
  ],
  controllers: [QuotesController],
  providers: [QuotesService],
  exports: [QuotesService],
})
export class QuotesModule {}
