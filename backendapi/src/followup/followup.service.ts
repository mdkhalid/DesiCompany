import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Booking } from '../bookings/entities/booking.entity';
import { BookingStatus } from '../common/enums/booking-status.enum';
import { Review } from '../reviews/entities/review.entity';
import { PushNotificationsService } from '../push-notifications/push-notifications.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class FollowUpService {
  private readonly logger = new Logger(FollowUpService.name);

  constructor(
    @InjectRepository(Booking)
    private readonly bookingRepository: Repository<Booking>,
    @InjectRepository(Review)
    private readonly reviewRepository: Repository<Review>,
    private readonly pushNotificationsService: PushNotificationsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async sendReviewFollowUps() {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

    const completedBookings = await this.bookingRepository.find({
      where: {
        status: BookingStatus.COMPLETED,
        updatedAt: Between(threeDaysAgo, oneDayAgo),
      },
      relations: {
        customer: { user: true },
        provider: { user: true },
        providerService: { category: true },
      },
    });

    let followUpsSent = 0;

    for (const booking of completedBookings) {
      const existingReview = await this.reviewRepository.findOne({
        where: { booking: { id: booking.id } },
      });

      if (existingReview) continue;

      const providerName = `${booking.provider.firstName} ${booking.provider.lastName}`;
      const serviceName = booking.providerService?.category?.nameEn || 'service';

      await this.notificationsService.create(
        booking.customer.user.id,
        'How was your service?',
        `Share your experience with ${providerName} for your ${serviceName}. Your feedback helps others!`,
      );

      this.pushNotificationsService
        .sendToUser(
          booking.customer.user.id,
          'Rate Your Service',
          `How was your ${serviceName} with ${providerName}? Tap to leave a review.`,
          { bookingId: booking.id, type: 'review_followup' },
        )
        .catch(() => {});

      followUpsSent++;
      this.logger.log(`Sent follow-up for booking ${booking.id}`);
    }

    return { followUpsSent, checkedBookings: completedBookings.length };
  }

  async sendReengagementFollowUps() {
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const recentBookings = await this.bookingRepository
      .createQueryBuilder('booking')
      .select('DISTINCT booking.customer_id', 'customerId')
      .where('booking.created_at >= :ninetyDaysAgo', { ninetyDaysAgo })
      .andWhere('booking.created_at < :sixtyDaysAgo', { sixtyDaysAgo })
      .getRawMany();

    let reengagementSent = 0;

    for (const { customerId } of recentBookings) {
      const customer = await this.bookingRepository
        .createQueryBuilder('booking')
        .leftJoinAndSelect('booking.customer', 'customer')
        .leftJoinAndSelect('customer.user', 'user')
        .where('booking.customer_id = :customerId', { customerId })
        .andWhere('booking.created_at >= :ninetyDaysAgo', { ninetyDaysAgo })
        .getOne();

      if (customer?.customer?.user) {
        await this.notificationsService.create(
          customer.customer.user.id,
          'We miss you!',
          'It\'s been a while since your last booking. Check out new providers in your area!',
        );

        this.pushNotificationsService
          .sendToUser(
            customer.customer.user.id,
            'We miss you!',
            'New providers and offers are waiting for you on DesiCompany.',
            { type: 'reengagement' },
          )
          .catch(() => {});

        reengagementSent++;
      }
    }

    return { reengagementSent };
  }
}