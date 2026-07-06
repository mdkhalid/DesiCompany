import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { CustomerFeedbacksService } from './customer-feedbacks.service';
import { CustomerFeedback } from './entities/customer-feedback.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { Provider } from '../users/entities/provider.entity';
import { BookingStatus } from '../common/enums/booking-status.enum';

type MockRepo = {
  find: jest.Mock;
  findOne: jest.Mock;
  create: jest.Mock;
  save: jest.Mock;
};

function makeRepoMock(): MockRepo {
  return {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };
}

describe('CustomerFeedbacksService', () => {
  let service: CustomerFeedbacksService;
  let feedbackRepository: MockRepo;
  let bookingRepository: MockRepo;
  let providerRepository: MockRepo;

  const providerUserId = 'user-1';
  const providerId = 'provider-1';
  const bookingId = 'booking-1';
  const customerId = 'customer-1';

  const mockProvider = {
    id: providerId,
    user: { id: providerUserId },
  };

  const mockBooking = {
    id: bookingId,
    provider: mockProvider,
    customer: { id: customerId },
    status: BookingStatus.COMPLETED,
  };

  const mockFeedback = {
    id: 'feedback-1',
    booking: mockBooking,
    provider: mockProvider,
    customer: { id: customerId },
    rating: 4,
    comment: 'Good customer',
    tags: ['paid_on_time', 'good_customer'],
  };

  beforeEach(async () => {
    feedbackRepository = makeRepoMock<CustomerFeedback>();
    bookingRepository = makeRepoMock<Booking>();
    providerRepository = makeRepoMock<Provider>();

    feedbackRepository.create.mockImplementation(
      (dto: Partial<CustomerFeedback>) => ({ id: 'feedback-new', ...dto }),
    );
    feedbackRepository.save.mockImplementation((entity: CustomerFeedback) =>
      Promise.resolve(entity),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomerFeedbacksService,
        {
          provide: getRepositoryToken(CustomerFeedback),
          useValue: feedbackRepository,
        },
        {
          provide: getRepositoryToken(Booking),
          useValue: bookingRepository,
        },
        {
          provide: getRepositoryToken(Provider),
          useValue: providerRepository,
        },
      ],
    }).compile();

    service = module.get(CustomerFeedbacksService);
    jest.clearAllMocks();

    feedbackRepository.create.mockImplementation(
      (dto: Partial<CustomerFeedback>) => ({ id: 'feedback-new', ...dto }),
    );
    feedbackRepository.save.mockImplementation((entity: CustomerFeedback) =>
      Promise.resolve(entity),
    );
  });

  describe('create', () => {
    it('creates feedback successfully for completed booking', async () => {
      providerRepository.findOne.mockResolvedValue(mockProvider);
      bookingRepository.findOne.mockResolvedValue(mockBooking);
      feedbackRepository.findOne.mockResolvedValue(null);

      const result = await service.create(
        {
          bookingId,
          rating: 4,
          comment: 'Good customer',
          tags: ['paid_on_time'],
        },
        providerUserId,
      );

      expect(result).toBeDefined();
      expect(result.rating).toBe(4);
      expect(result.tags).toEqual(['paid_on_time']);
      expect(feedbackRepository.create).toHaveBeenCalled();
      expect(feedbackRepository.save).toHaveBeenCalled();
    });

    it('throws NotFound when provider profile missing', async () => {
      providerRepository.findOne.mockResolvedValue(null);

      await expect(
        service.create({ bookingId, rating: 4 }, providerUserId),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFound when booking missing', async () => {
      providerRepository.findOne.mockResolvedValue(mockProvider);
      bookingRepository.findOne.mockResolvedValue(null);

      await expect(
        service.create({ bookingId, rating: 4 }, providerUserId),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws Forbidden when booking belongs to a different provider', async () => {
      providerRepository.findOne.mockResolvedValue(mockProvider);
      bookingRepository.findOne.mockResolvedValue({
        ...mockBooking,
        provider: { id: 'other-provider', user: { id: 'other-user' } },
      });

      await expect(
        service.create({ bookingId, rating: 4 }, providerUserId),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequest when booking is not completed', async () => {
      providerRepository.findOne.mockResolvedValue(mockProvider);
      bookingRepository.findOne.mockResolvedValue({
        ...mockBooking,
        status: BookingStatus.ACCEPTED,
      });

      await expect(
        service.create({ bookingId, rating: 4 }, providerUserId),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequest when feedback already exists for booking', async () => {
      providerRepository.findOne.mockResolvedValue(mockProvider);
      bookingRepository.findOne.mockResolvedValue(mockBooking);
      feedbackRepository.findOne.mockResolvedValue(mockFeedback);

      await expect(
        service.create({ bookingId, rating: 4 }, providerUserId),
      ).rejects.toThrow(BadRequestException);
    });

    it('defaults tags to empty array when not provided', async () => {
      providerRepository.findOne.mockResolvedValue(mockProvider);
      bookingRepository.findOne.mockResolvedValue(mockBooking);
      feedbackRepository.findOne.mockResolvedValue(null);

      await service.create({ bookingId, rating: 5 }, providerUserId);

      expect(feedbackRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ tags: [] }),
      );
    });
  });

  describe('findByProvider', () => {
    it('returns feedback for a provider', async () => {
      feedbackRepository.find.mockResolvedValue([mockFeedback]);
      const result = await service.findByProvider(providerId);
      expect(result).toEqual([mockFeedback]);
      expect(feedbackRepository.find).toHaveBeenCalledWith({
        where: { provider: { id: providerId } },
        relations: { booking: { customer: { user: true } }, customer: { user: true } },
        order: { createdAt: 'DESC' },
      });
    });
  });

  describe('findByProviderUser', () => {
    it('returns empty array when provider profile missing', async () => {
      providerRepository.findOne.mockResolvedValue(null);
      const result = await service.findByProviderUser(providerUserId);
      expect(result).toEqual([]);
    });

    it('returns feedback for the provider behind the user', async () => {
      providerRepository.findOne.mockResolvedValue(mockProvider);
      feedbackRepository.find.mockResolvedValue([mockFeedback]);

      const result = await service.findByProviderUser(providerUserId);
      expect(result).toEqual([mockFeedback]);
      expect(feedbackRepository.find).toHaveBeenCalledWith({
        where: { provider: { id: providerId } },
        relations: { booking: { customer: { user: true } }, customer: { user: true } },
        order: { createdAt: 'DESC' },
      });
    });
  });

  describe('findAll', () => {
    it('returns all feedback for admin', async () => {
      feedbackRepository.find.mockResolvedValue([mockFeedback]);
      const result = await service.findAll();
      expect(result).toEqual([mockFeedback]);
      expect(feedbackRepository.find).toHaveBeenCalledWith({
        relations: {
          booking: { customer: { user: true } },
          customer: { user: true },
          provider: { user: true },
        },
        order: { createdAt: 'DESC' },
      });
    });
  });
});
