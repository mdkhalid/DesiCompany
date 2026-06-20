import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BookingPhoto, PhotoStage } from './entities/booking-photo.entity';
import { Booking } from './entities/booking.entity';

@Injectable()
export class BookingPhotosService {
  constructor(
    @InjectRepository(BookingPhoto)
    private readonly photoRepository: Repository<BookingPhoto>,
    @InjectRepository(Booking)
    private readonly bookingRepository: Repository<Booking>,
  ) {}

  async addPhoto(
    bookingId: string,
    stage: PhotoStage,
    photoUrl: string,
    caption?: string,
  ) {
    const booking = await this.bookingRepository.findOne({
      where: { id: bookingId },
    });
    if (!booking) throw new NotFoundException('Booking not found');

    const count = await this.photoRepository.count({
      where: { booking: { id: bookingId }, stage },
    });

    const photo = this.photoRepository.create({
      booking,
      stage,
      photoUrl,
      caption: caption ?? undefined,
      displayOrder: count,
    });
    return this.photoRepository.save(photo);
  }

  async getBookingPhotos(bookingId: string) {
    return this.photoRepository.find({
      where: { booking: { id: bookingId } },
      order: { stage: 'ASC', displayOrder: 'ASC' },
    });
  }

  async getStagePhotos(bookingId: string, stage: PhotoStage) {
    return this.photoRepository.find({
      where: { booking: { id: bookingId }, stage },
      order: { displayOrder: 'ASC' },
    });
  }

  async deletePhoto(photoId: string) {
    const photo = await this.photoRepository.findOne({
      where: { id: photoId },
    });
    if (!photo) throw new NotFoundException('Photo not found');
    await this.photoRepository.remove(photo);
    return { message: 'Photo deleted' };
  }
}
