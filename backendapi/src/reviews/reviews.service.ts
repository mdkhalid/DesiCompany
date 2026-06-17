import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Review } from './entities/review.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { Customer } from '../users/entities/customer.entity';
import { Provider } from '../users/entities/provider.entity';
import { BookingStatus } from '../common/enums/booking-status.enum';
import { UserRole } from '../common/enums/user-role.enum';
import { CreateReviewDto } from './dto/create-review.dto';

@Injectable()
export class ReviewsService {
  constructor(
    @InjectRepository(Review)
    private readonly reviewRepository: Repository<Review>,
    @InjectRepository(Booking)
    private readonly bookingRepository: Repository<Booking>,
    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,
    @InjectRepository(Provider)
    private readonly providerRepository: Repository<Provider>,
  ) {}

  async create(dto: CreateReviewDto, userId: string, role: UserRole) {
    const booking = await this.bookingRepository.findOne({
      where: { id: dto.bookingId },
      relations: { customer: { user: true }, provider: true },
    });
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }
    if (booking.status !== BookingStatus.COMPLETED) {
      throw new BadRequestException('Can only review completed bookings');
    }

    if (role === UserRole.CUSTOMER) {
      const customer = await this.customerRepository.findOne({
        where: { user: { id: userId } },
      });
      if (!customer || booking.customer.id !== customer.id) {
        throw new ForbiddenException('You can only review your own bookings');
      }
    }

    const existing = await this.reviewRepository.findOne({
      where: { booking: { id: dto.bookingId } },
    });
    if (existing) {
      throw new BadRequestException('Booking already reviewed');
    }

    const customer = await this.customerRepository.findOne({
      where: { user: { id: userId } },
    });
    if (!customer) {
      throw new NotFoundException('Customer profile not found');
    }

    const review = this.reviewRepository.create({
      booking,
      customer,
      provider: booking.provider,
      rating: dto.rating,
      comment: dto.comment,
    });
    await this.reviewRepository.save(review);

    await this.updateProviderRating(booking.provider.id);

    return review;
  }

  async findByProvider(providerId: string) {
    return this.reviewRepository.find({
      where: { provider: { id: providerId } },
      relations: { customer: { user: true }, booking: true },
      order: { createdAt: 'DESC' },
    });
  }

  async findByCustomer(customerId: string) {
    return this.reviewRepository.find({
      where: { customer: { id: customerId } },
      relations: { provider: { user: true }, booking: true },
      order: { createdAt: 'DESC' },
    });
  }

  async findByBooking(bookingId: string) {
    const review = await this.reviewRepository.findOne({
      where: { booking: { id: bookingId } },
      relations: { customer: { user: true }, provider: { user: true } },
    });
    if (!review) {
      throw new NotFoundException('Review not found for this booking');
    }
    return review;
  }

  private async updateProviderRating(providerId: string) {
    const stats = await this.reviewRepository
      .createQueryBuilder('review')
      .select('AVG(review.rating)', 'avg')
      .addSelect('COUNT(review.id)', 'count')
      .where('review.provider_id = :providerId', { providerId })
      .getRawOne();

    const avgRating = stats?.avg ? Number(Number(stats.avg).toFixed(2)) : 0;
    const totalReviews = Number(stats?.count ?? 0);

    await this.providerRepository.update(providerId, {
      averageRating: avgRating,
      totalReviews,
    });
  }
}
