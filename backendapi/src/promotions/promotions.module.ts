import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PromotionsController } from './promotions.controller';
import { PromotionsService } from './promotions.service';
import { PromotedListing } from './entities/promoted-listing.entity';
import { Provider } from '../users/entities/provider.entity';
import { ServiceCategory } from '../services/entities/service-category.entity';
import { Wallet } from '../payments/entities/wallet.entity';
import { Transaction } from '../payments/entities/transaction.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PromotedListing,
      Provider,
      ServiceCategory,
      Wallet,
      Transaction,
    ]),
  ],
  controllers: [PromotionsController],
  providers: [PromotionsService],
  exports: [PromotionsService],
})
export class PromotionsModule {}