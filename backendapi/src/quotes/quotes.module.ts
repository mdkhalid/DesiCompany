import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Booking } from '../bookings/entities/booking.entity';
import { ServiceCategory } from '../services/entities/service-category.entity';
import { ProviderService } from '../services/entities/provider-service.entity';
import { Customer } from '../users/entities/customer.entity';
import { Provider } from '../users/entities/provider.entity';
import { JobRequest } from './entities/job-request.entity';
import { Quote } from './entities/quote.entity';
import { QuotesController } from './quotes.controller';
import { QuotesService } from './quotes.service';

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
    ]),
  ],
  controllers: [QuotesController],
  providers: [QuotesService],
  exports: [QuotesService],
})
export class QuotesModule {}
