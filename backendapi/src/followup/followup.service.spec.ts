import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { FollowUpService } from './followup.service';
import { Booking } from '../bookings/entities/booking.entity';
import { Review } from '../reviews/entities/review.entity';
import { PushNotificationsService } from '../push-notifications/push-notifications.service';
import { NotificationsService } from '../notifications/notifications.service';

type MockRepo = {
  find: jest.Mock;
  findOne: jest.Mock;
  createQueryBuilder: jest.Mock;
};

function makeRepoMock(): MockRepo {
  return {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(null),
      getRawMany: jest.fn().mockResolvedValue([]),
    })),
  };
}

describe('FollowUpService', () => {
  let service: FollowUpService;
  let bookingRepo: MockRepo;
  let reviewRepo: MockRepo;
  let pushService: { sendToUser: jest.Mock };
  let notifService: { create: jest.Mock };

  beforeEach(async () => {
    bookingRepo = makeRepoMock();
    reviewRepo = makeRepoMock();
    pushService = { sendToUser: jest.fn().mockResolvedValue(undefined) };
    notifService = { create: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FollowUpService,
        { provide: getRepositoryToken(Booking), useValue: bookingRepo },
        { provide: getRepositoryToken(Review), useValue: reviewRepo },
        { provide: PushNotificationsService, useValue: pushService },
        { provide: NotificationsService, useValue: notifService },
      ],
    }).compile();
    service = module.get<FollowUpService>(FollowUpService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('sendReviewFollowUps', () => {
    it('should return zero when no bookings match', async () => {
      const result = await service.sendReviewFollowUps();
      expect(result.followUpsSent).toBe(0);
      expect(result.checkedBookings).toBe(0);
    });

    it('should skip bookings that already have reviews', async () => {
      bookingRepo.find.mockResolvedValue([
        { id: 'b1', provider: { firstName: 'R', lastName: 'K' }, customer: { user: { id: 'u1' } }, providerService: { category: { nameEn: 'Plumbing' } } },
      ]);
      reviewRepo.findOne.mockResolvedValue({ id: 'r1' });

      const result = await service.sendReviewFollowUps();
      expect(result.followUpsSent).toBe(0);
    });
  });

  describe('sendReengagementFollowUps', () => {
    it('should return zero when no recent customers', async () => {
      const result = await service.sendReengagementFollowUps();
      expect(result.reengagementSent).toBe(0);
    });
  });
});
