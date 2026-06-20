import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReferralsController } from './referrals.controller';
import { ReferralsService } from './referrals.service';
import { Referral } from './entities/referral.entity';
import { User } from '../users/entities/user.entity';
import { Wallet } from '../payments/entities/wallet.entity';
import { Transaction } from '../payments/entities/transaction.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Referral, User, Wallet, Transaction])],
  controllers: [ReferralsController],
  providers: [ReferralsService],
  exports: [ReferralsService],
})
export class ReferralsModule {}
