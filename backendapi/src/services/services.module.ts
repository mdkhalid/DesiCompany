import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServicesController } from './services.controller';
import { ServicesService } from './services.service';
import { ServiceCategory } from './entities/service-category.entity';
import { ProviderService } from './entities/provider-service.entity';
import { ProviderAvailability } from './entities/provider-availability.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ServiceCategory,
      ProviderService,
      ProviderAvailability,
    ]),
  ],
  controllers: [ServicesController],
  providers: [ServicesService],
  exports: [ServicesService],
})
export class ServicesModule {}
