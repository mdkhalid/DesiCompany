import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommissionService } from './commission.service';
import { CommissionConfig } from './entities/commission-config.entity';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [TypeOrmModule.forFeature([CommissionConfig]), SettingsModule],
  providers: [CommissionService],
  exports: [CommissionService],
})
export class CommissionsModule {}
