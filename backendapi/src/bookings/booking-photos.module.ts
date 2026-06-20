import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BookingPhotosController } from './booking-photos.controller';
import { BookingPhotosService } from './booking-photos.service';
import { BookingPhoto } from './entities/booking-photo.entity';
import { Booking } from './entities/booking.entity';

@Module({
  imports: [TypeOrmModule.forFeature([BookingPhoto, Booking])],
  controllers: [BookingPhotosController],
  providers: [BookingPhotosService],
  exports: [BookingPhotosService],
})
export class BookingPhotosModule {}