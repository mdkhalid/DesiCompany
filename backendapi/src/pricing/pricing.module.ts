import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PricingController } from './pricing.controller';
import { DynamicPricingService } from './dynamic-pricing.service';
import { ServiceCategory } from '../services/entities/service-category.entity';
import { Booking } from '../bookings/entities/booking.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ServiceCategory, Booking])],
  controllers: [PricingController],
  providers: [DynamicPricingService],
  exports: [DynamicPricingService],
})
export class PricingModule {}
