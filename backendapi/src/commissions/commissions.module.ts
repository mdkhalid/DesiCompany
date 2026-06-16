import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommissionService } from './commission.service';
import { CommissionConfig } from './entities/commission-config.entity';

@Module({
  imports: [TypeOrmModule.forFeature([CommissionConfig])],
  providers: [CommissionService],
  exports: [CommissionService],
})
export class CommissionsModule {}
