import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Provider } from '../users/entities/provider.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { BookingStatus } from '../common/enums/booking-status.enum';

export enum BadgeType {
  TOP_RATED = 'top_rated',
  FAST_RESPONDER = 'fast_responder',
  EXPERIENCED = 'experienced',
  RELIABLE = 'reliable',
}

@Injectable()
export class BadgesService {
  constructor(
    @InjectRepository(Provider)
    private readonly providerRepository: Repository<Provider>,
    @InjectRepository(Booking)
    private readonly bookingRepository: Repository<Booking>,
  ) {}

  async calculateProviderBadges(providerId: string): Promise<BadgeType[]> {
    const provider = await this.providerRepository.findOne({
      where: { id: providerId },
    });
    if (!provider) return [];

    const badges: BadgeType[] = [];

    // TOP_RATED: 4.5+ rating with 20+ reviews
    if (Number(provider.averageRating) >= 4.5 && provider.totalReviews >= 20) {
      badges.push(BadgeType.TOP_RATED);
    }

    // EXPERIENCED: 50+ completed bookings
    const completedBookings = await this.bookingRepository.count({
      where: { provider: { id: providerId }, status: BookingStatus.COMPLETED },
    });
    if (completedBookings >= 50) {
      badges.push(BadgeType.EXPERIENCED);
    }

    // RELIABLE: 95%+ completion rate (min 20 bookings)
    const totalBookings = await this.bookingRepository.count({
      where: { provider: { id: providerId } },
    });
    if (totalBookings >= 20 && completedBookings / totalBookings >= 0.95) {
      badges.push(BadgeType.RELIABLE);
    }

    // FAST_RESPONDER: placeholder logic (would need request timestamps)
    // For now, grant to providers with good rating and recent activity
    if (Number(provider.averageRating) >= 4.0 && totalBookings >= 10) {
      badges.push(BadgeType.FAST_RESPONDER);
    }

    return badges;
  }

  async getProviderWithBadges(providerId: string) {
    const provider = await this.providerRepository.findOne({
      where: { id: providerId },
      relations: { user: true },
    });
    if (!provider) return null;

    const badges = await this.calculateProviderBadges(providerId);
    return {
      ...provider,
      badges,
    };
  }

  async getBadgeMetadata() {
    return [
      {
        type: BadgeType.TOP_RATED,
        name: 'Top Rated',
        description: '4.5+ rating with 20+ reviews',
        icon: 'star',
        color: '#FFD700',
      },
      {
        type: BadgeType.FAST_RESPONDER,
        name: 'Fast Responder',
        description: 'Responds to bookings quickly',
        icon: 'bolt',
        color: '#FFA500',
      },
      {
        type: BadgeType.EXPERIENCED,
        name: 'Experienced',
        description: 'Completed 50+ bookings',
        icon: 'trophy',
        color: '#C0C0C0',
      },
      {
        type: BadgeType.RELIABLE,
        name: 'Reliable',
        description: '95%+ completion rate (20+ bookings)',
        icon: 'shield',
        color: '#00C853',
      },
    ];
  }
}
