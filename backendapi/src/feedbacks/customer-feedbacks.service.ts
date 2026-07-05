import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Booking } from '../bookings/entities/booking.entity';
import { BookingStatus } from '../common/enums/booking-status.enum';
import { Provider } from '../users/entities/provider.entity';
import { CreateCustomerFeedbackDto } from './dto/create-customer-feedback.dto';
import { CustomerFeedback } from './entities/customer-feedback.entity';

@Injectable()
export class CustomerFeedbacksService {
  constructor(
    @InjectRepository(CustomerFeedback)
    private readonly feedbackRepository: Repository<CustomerFeedback>,
    @InjectRepository(Booking)
    private readonly bookingRepository: Repository<Booking>,
    @InjectRepository(Provider)
    private readonly providerRepository: Repository<Provider>,
  ) {}

  async create(dto: CreateCustomerFeedbackDto, providerUserId: string) {
    const provider = await this.providerRepository.findOne({
      where: { user: { id: providerUserId } },
    });
    if (!provider) {
      throw new NotFoundException('Provider profile not found');
    }

    const booking = await this.bookingRepository.findOne({
      where: { id: dto.bookingId },
      relations: { provider: { user: true }, customer: true },
    });
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (booking.provider.id !== provider.id) {
      throw new ForbiddenException(
        'You can only leave feedback for your own bookings',
      );
    }

    if (booking.status !== BookingStatus.COMPLETED) {
      throw new BadRequestException(
        'Can only leave feedback for completed bookings',
      );
    }

    const existing = await this.feedbackRepository.findOne({
      where: { booking: { id: dto.bookingId } },
    });
    if (existing) {
      throw new BadRequestException('Feedback already exists for this booking');
    }

    const feedback = this.feedbackRepository.create({
      booking,
      provider,
      customer: booking.customer,
      rating: dto.rating,
      comment: dto.comment,
      tags: dto.tags ?? [],
    });
    await this.feedbackRepository.save(feedback);

    return feedback;
  }

  findByProvider(providerId: string) {
    return this.feedbackRepository.find({
      where: { provider: { id: providerId } },
      relations: { booking: { customer: { user: true } }, customer: { user: true } },
      order: { createdAt: 'DESC' },
    });
  }

  async findByProviderUser(providerUserId: string) {
    const provider = await this.providerRepository.findOne({
      where: { user: { id: providerUserId } },
    });
    if (!provider) {
      return [];
    }
    return this.findByProvider(provider.id);
  }

  findAll() {
    return this.feedbackRepository.find({
      relations: {
        booking: { customer: { user: true } },
        customer: { user: true },
        provider: { user: true },
      },
      order: { createdAt: 'DESC' },
    });
  }
}
