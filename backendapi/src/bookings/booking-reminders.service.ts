import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Booking } from '../bookings/entities/booking.entity';
import { BookingStatus } from '../common/enums/booking-status.enum';
import { PushNotificationsService } from '../push-notifications/push-notifications.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class BookingRemindersService {
  private readonly logger = new Logger(BookingRemindersService.name);

  constructor(
    @InjectRepository(Booking)
    private readonly bookingRepository: Repository<Booking>,
    private readonly pushNotificationsService: PushNotificationsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async sendUpcomingBookingReminders() {
    const now = new Date();
    const twoHoursLater = new Date(now.getTime() + 2 * 60 * 60 * 1000);

    const bookings = await this.bookingRepository.find({
      where: {
        status: BookingStatus.ACCEPTED,
        scheduledDate: Between(now, twoHoursLater),
      },
      relations: {
        customer: { user: true },
        provider: { user: true },
        providerService: { category: true },
      },
    });

    let remindersSent = 0;

    for (const booking of bookings) {
      const scheduledTime = new Date(booking.scheduledDate);
      const timeDiff = scheduledTime.getTime() - now.getTime();
      const minutesUntil = Math.round(timeDiff / (1000 * 60));

      if (minutesUntil <= 60 && minutesUntil > 0) {
        const providerName = `${booking.provider.firstName} ${booking.provider.lastName}`;
        const serviceName =
          booking.providerService?.category?.nameEn || 'Service';

        // Notify customer
        await this.notificationsService.create(
          booking.customer.user.id,
          'Service Reminder',
          `${providerName} will arrive in ${minutesUntil} minutes for your ${serviceName} service.`,
        );

        this.pushNotificationsService
          .sendToUser(
            booking.customer.user.id,
            'Service Reminder',
            `${providerName} will arrive in ${minutesUntil} minutes for your ${serviceName} service.`,
            { bookingId: booking.id, type: 'reminder' },
          )
          .catch(() => {});

        // Notify provider
        const customerUser = booking.customer.user;
        const customerName = customerUser.email || customerUser.phone;

        await this.notificationsService.create(
          booking.provider.user.id,
          'Service Reminder',
          `You have a ${serviceName} service in ${minutesUntil} minutes with ${customerName}.`,
        );

        this.pushNotificationsService
          .sendToUser(
            booking.provider.user.id,
            'Service Reminder',
            `You have a ${serviceName} service in ${minutesUntil} minutes with ${customerName}.`,
            { bookingId: booking.id, type: 'reminder' },
          )
          .catch(() => {});

        remindersSent++;
        this.logger.log(
          `Sent reminder for booking ${booking.id} (${minutesUntil} min)`,
        );
      }
    }

    return { remindersSent, checkedBookings: bookings.length };
  }

  async sendCompletionReminders() {
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

    const bookings = await this.bookingRepository.find({
      where: {
        status: BookingStatus.COMPLETED,
        scheduledDate: Between(twoDaysAgo, oneDayAgo),
      },
      relations: {
        customer: { user: true },
        provider: { user: true },
        providerService: { category: true },
      },
    });

    let remindersSent = 0;

    for (const booking of bookings) {
      const providerName = `${booking.provider.firstName} ${booking.provider.lastName}`;
      const serviceName =
        booking.providerService?.category?.nameEn || 'Service';

      await this.notificationsService.create(
        booking.customer.user.id,
        'Rate Your Experience',
        `How was your ${serviceName} service with ${providerName}? Leave a review to help others.`,
      );

      this.pushNotificationsService
        .sendToUser(
          booking.customer.user.id,
          'Rate Your Experience',
          `How was your ${serviceName} service with ${providerName}? Leave a review to help others.`,
          { bookingId: booking.id, type: 'review_reminder' },
        )
        .catch(() => {});

      remindersSent++;
    }

    return { remindersSent, checkedBookings: bookings.length };
  }
}
