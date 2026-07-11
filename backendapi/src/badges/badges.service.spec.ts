import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadgesService, BadgeType } from './badges.service';
import { Provider } from '../users/entities/provider.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { BookingStatus } from '../common/enums/booking-status.enum';

type MockRepo = {
  findOne: jest.Mock;
  count: jest.Mock;
};

describe('BadgesService', () => {
  let service: BadgesService;
  let providerRepo: MockRepo;
  let bookingRepo: MockRepo;

  beforeEach(async () => {
    providerRepo = { findOne: jest.fn(), count: jest.fn() };
    bookingRepo = { findOne: jest.fn(), count: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BadgesService,
        { provide: getRepositoryToken(Provider), useValue: providerRepo },
        { provide: getRepositoryToken(Booking), useValue: bookingRepo },
      ],
    }).compile();

    service = module.get<BadgesService>(BadgesService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('calculateProviderBadges', () => {
    it('should return empty array when provider not found', async () => {
      providerRepo.findOne.mockResolvedValue(null);

      const result = await service.calculateProviderBadges('p1');
      expect(result).toEqual([]);
    });

    it('should return TOP_RATED badge for high-rated provider', async () => {
      providerRepo.findOne.mockResolvedValue({
        averageRating: 4.8,
        totalReviews: 25,
      });
      bookingRepo.count.mockResolvedValue(0);

      const result = await service.calculateProviderBadges('p1');
      expect(result).toContain(BadgeType.TOP_RATED);
    });

    it('should not return TOP_RATED for low reviews', async () => {
      providerRepo.findOne.mockResolvedValue({
        averageRating: 4.8,
        totalReviews: 5,
      });
      bookingRepo.count.mockResolvedValue(0);

      const result = await service.calculateProviderBadges('p1');
      expect(result).not.toContain(BadgeType.TOP_RATED);
    });

    it('should return EXPERIENCED badge for 50+ completed bookings', async () => {
      providerRepo.findOne.mockResolvedValue({
        averageRating: 4.0,
        totalReviews: 10,
      });
      bookingRepo.count
        .mockResolvedValueOnce(55) // completed bookings
        .mockResolvedValueOnce(55); // total bookings

      const result = await service.calculateProviderBadges('p1');
      expect(result).toContain(BadgeType.EXPERIENCED);
    });

    it('should return RELIABLE badge for 95%+ completion rate with 20+ bookings', async () => {
      providerRepo.findOne.mockResolvedValue({
        averageRating: 4.0,
        totalReviews: 10,
      });
      bookingRepo.count
        .mockResolvedValueOnce(30) // completed
        .mockResolvedValueOnce(30); // total

      const result = await service.calculateProviderBadges('p1');
      expect(result).toContain(BadgeType.RELIABLE);
    });

    it('should return FAST_RESPONDER for provider with 4+ rating and 10+ bookings', async () => {
      providerRepo.findOne.mockResolvedValue({
        averageRating: 4.2,
        totalReviews: 10,
      });
      bookingRepo.count
        .mockResolvedValueOnce(0) // completed
        .mockResolvedValueOnce(15); // total

      const result = await service.calculateProviderBadges('p1');
      expect(result).toContain(BadgeType.FAST_RESPONDER);
    });
  });

  describe('getProviderWithBadges', () => {
    it('should return null when provider not found', async () => {
      providerRepo.findOne.mockResolvedValue(null);

      const result = await service.getProviderWithBadges('p1');
      expect(result).toBeNull();
    });

    it('should return provider with badges array', async () => {
      providerRepo.findOne.mockResolvedValue({
        id: 'p1',
        averageRating: 4.8,
        totalReviews: 25,
        user: { id: 'u1' },
      });
      bookingRepo.count.mockResolvedValue(0);

      const result = await service.getProviderWithBadges('p1');
      expect(result.id).toBe('p1');
      expect(result.badges).toBeDefined();
      expect(Array.isArray(result.badges)).toBe(true);
    });
  });

  describe('getBadgeMetadata', () => {
    it('should return 4 badge metadata entries', () => {
      const metadata = service.getBadgeMetadata();
      expect(metadata).toHaveLength(4);
      expect(metadata.map((m) => m.type)).toContain(BadgeType.TOP_RATED);
    });
  });
});
