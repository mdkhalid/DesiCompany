import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommissionService } from './commission.service';
import { CommissionConfig } from './entities/commission-config.entity';
import { SettingsModule } from '../settings/settings.module';
import { PlatformFeesModule } from '../platform-fees/platform-fees.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([CommissionConfig]),
    SettingsModule,
    PlatformFeesModule,
  ],
  providers: [CommissionService],
  exports: [CommissionService],
})
export class CommissionsModule {}
