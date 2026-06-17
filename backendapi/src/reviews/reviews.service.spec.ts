import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { ReviewsService } from './reviews.service';
import { Review } from './entities/review.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { Customer } from '../users/entities/customer.entity';
import { Provider } from '../users/entities/provider.entity';
import { BookingStatus } from '../common/enums/booking-status.enum';
import { UserRole } from '../common/enums/user-role.enum';

describe('ReviewsService', () => {
  let service: ReviewsService;
  let reviewRepo: jest.Mocked<Repository<Review>>;
  let bookingRepo: jest.Mocked<Repository<Booking>>;
  let customerRepo: jest.Mocked<Repository<Customer>>;
  let providerRepo: jest.Mocked<Repository<Provider>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReviewsService,
        {
          provide: getRepositoryToken(Review),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            createQueryBuilder: jest.fn(() => ({
              select: jest.fn().mockReturnThis(),
              addSelect: jest.fn().mockReturnThis(),
              where: jest.fn().mockReturnThis(),
              getRawOne: jest.fn(),
            })),
          },
        },
        {
          provide: getRepositoryToken(Booking),
          useValue: { findOne: jest.fn() },
        },
        {
          provide: getRepositoryToken(Customer),
          useValue: { findOne: jest.fn() },
        },
        {
          provide: getRepositoryToken(Provider),
          useValue: { update: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(ReviewsService);
    reviewRepo = module.get(getRepositoryToken(Review));
    bookingRepo = module.get(getRepositoryToken(Booking));
    customerRepo = module.get(getRepositoryToken(Customer));
    providerRepo = module.get(getRepositoryToken(Provider));
  });

  describe('create', () => {
    const userId = 'user-1';
    const dto = { bookingId: 'booking-1', rating: 5, comment: 'Great!' };

    it('throws NotFoundException when booking not found', async () => {
      bookingRepo.findOne.mockResolvedValue(null);
      await expect(service.create(dto, userId, UserRole.CUSTOMER))
        .rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when booking not completed', async () => {
      bookingRepo.findOne.mockResolvedValue({
        id: 'booking-1',
        status: BookingStatus.WORKING,
        customer: { id: 'cust-1' },
        provider: { id: 'prov-1' },
      } as any);
      await expect(service.create(dto, userId, UserRole.CUSTOMER))
        .rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when booking already reviewed', async () => {
      customerRepo.findOne.mockResolvedValue({ id: 'cust-1', user: { id: userId } } as any);
      bookingRepo.findOne.mockResolvedValue({
        id: 'booking-1',
        status: BookingStatus.COMPLETED,
        customer: { id: 'cust-1' },
        provider: { id: 'prov-1' },
      } as any);
      reviewRepo.findOne.mockResolvedValue({ id: 'existing-review' } as any);
      await expect(service.create(dto, userId, UserRole.CUSTOMER))
        .rejects.toThrow(BadRequestException);
    });

    it('creates a review and updates provider rating', async () => {
      customerRepo.findOne.mockResolvedValue({ id: 'cust-1', user: { id: userId } } as any);
      bookingRepo.findOne.mockResolvedValue({
        id: 'booking-1',
        status: BookingStatus.COMPLETED,
        customer: { id: 'cust-1' },
        provider: { id: 'prov-1' },
      } as any);
      reviewRepo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      reviewRepo.create.mockReturnValue({} as any);
      (reviewRepo.createQueryBuilder as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ avg: '4.5', count: '10' }),
      });

      const result = await service.create(dto, userId, UserRole.CUSTOMER);
      expect(result).toBeDefined();
      expect(providerRepo.update).toHaveBeenCalledWith('prov-1', {
        averageRating: 4.5,
        totalReviews: 10,
      });
    });
  });

  describe('findByProvider', () => {
    it('returns reviews for a provider', async () => {
      reviewRepo.find.mockResolvedValue([{ id: 'rev-1', rating: 5 } as any]);
      const result = await service.findByProvider('prov-1');
      expect(result).toHaveLength(1);
    });
  });
});
