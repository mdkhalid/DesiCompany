import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServicesController } from './services.controller';
import { ServicesService } from './services.service';
import { ServiceAreaMapController } from './service-area-map.controller';
import { ServiceAreaMapService } from './service-area-map.service';
import { ServiceCategory } from './entities/service-category.entity';
import { ProviderService } from './entities/provider-service.entity';
import { ProviderAvailability } from './entities/provider-availability.entity';
import { ProviderDateOverride } from './entities/provider-date-override.entity';
import { ProviderBusySlot } from './entities/provider-busy-slot.entity';
import { Provider } from '../users/entities/provider.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { SettingsModule } from '../settings/settings.module';
import { ChatModule } from '../chat/chat.module';
import { PlatformFeesModule } from '../platform-fees/platform-fees.module';
import { MonitoringModule } from '../monitoring/monitoring.module';
import { CacheService } from '../common/cache.service';

@Module({
  imports: [
    MonitoringModule,
    TypeOrmModule.forFeature([
      ServiceCategory,
      ProviderService,
      ProviderAvailability,
      ProviderDateOverride,
      ProviderBusySlot,
      Provider,
      Booking,
    ]),
    SettingsModule,
    ChatModule,
    PlatformFeesModule,
  ],
  controllers: [ServicesController, ServiceAreaMapController],
  providers: [ServicesService, ServiceAreaMapService, CacheService],
  exports: [ServicesService, ServiceAreaMapService],
})
export class ServicesModule {}
