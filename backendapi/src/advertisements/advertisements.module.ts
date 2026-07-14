import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { Advertisement } from './entities/advertisement.entity';
import { AdvertisementsService } from './advertisements.service';
import { AdvertisementsController } from './advertisements.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Advertisement]), ScheduleModule],
  controllers: [AdvertisementsController],
  providers: [AdvertisementsService],
  exports: [AdvertisementsService],
})
export class AdvertisementsModule {}
