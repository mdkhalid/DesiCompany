import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { QuotesService } from './quotes.service';
import { JobRequest } from './entities/job-request.entity';
import { Quote } from './entities/quote.entity';
import { JobRequestStatus } from './entities/job-request-status.enum';
import { QuoteStatus } from './entities/quote-status.enum';
import { Customer } from '../users/entities/customer.entity';
import { Provider } from '../users/entities/provider.entity';
import { ServiceCategory } from '../services/entities/service-category.entity';
import { ProviderService } from '../services/entities/provider-service.entity';
import { Booking } from '../bookings/entities/booking.entity';

type MockRepo = {
  find: jest.Mock;
  findOne: jest.Mock;
  create: jest.Mock;
  save: jest.Mock;
  createQueryBuilder: jest.Mock;
};

function makeRepoMock(): MockRepo {
  return {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
}

describe('QuotesService', () => {
  let service: QuotesService;
  let jobRequestRepository: MockRepo;
  let quoteRepository: MockRepo;
  let customerRepository: MockRepo;
  let providerRepository: MockRepo;
  let categoryRepository: MockRepo;
  let providerServiceRepository: MockRepo;
  let bookingRepository: MockRepo;

  const customerUserId = 'user-c-1';
  const customerId = 'cust-1';
  const providerUserId = 'user-p-1';
  const providerId = 'prov-1';
  const categoryId = 'cat-1';
  const jobRequestId = 'jr-1';
  const quoteId = 'q-1';

  const mockCustomer = {
    id: customerId,
    user: { id: customerUserId },
  };

  const mockProvider = {
    id: providerId,
    user: { id: providerUserId },
  };

  const mockCategory = { id: categoryId, nameEn: 'Plumber' };

  const mockJobRequest = {
    id: jobRequestId,
    customer: mockCustomer,
    category: mockCategory,
    title: 'Fix kitchen sink',
    description: 'Leaking pipe',
    status: JobRequestStatus.OPEN,
    preferredDate: new Date(),
    latitude: null,
    longitude: null,
  };

  const mockQuote = {
    id: quoteId,
    jobRequest: mockJobRequest,
    provider: mockProvider,
    amount: 500,
    message: 'Can do tomorrow',
    status: QuoteStatus.PENDING,
  };

  beforeEach(async () => {
    jobRequestRepository = makeRepoMock();
    quoteRepository = makeRepoMock();
    customerRepository = makeRepoMock();
    providerRepository = makeRepoMock();
    categoryRepository = makeRepoMock();
    providerServiceRepository = makeRepoMock();
    bookingRepository = makeRepoMock();

    jobRequestRepository.create.mockImplementation(
      (dto: Partial<JobRequest>) => ({ id: 'jr-new', ...dto }),
    );
    jobRequestRepository.save.mockImplementation((entity: JobRequest) =>
      Promise.resolve(entity),
    );
    quoteRepository.create.mockImplementation((dto: Partial<Quote>) => ({
      id: 'q-new',
      ...dto,
    }));
    quoteRepository.save.mockImplementation((entity: Quote) =>
      Promise.resolve(entity),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuotesService,
        {
          provide: getRepositoryToken(JobRequest),
          useValue: jobRequestRepository,
        },
        { provide: getRepositoryToken(Quote), useValue: quoteRepository },
        { provide: getRepositoryToken(Customer), useValue: customerRepository },
        { provide: getRepositoryToken(Provider), useValue: providerRepository },
        {
          provide: getRepositoryToken(ServiceCategory),
          useValue: categoryRepository,
        },
        {
          provide: getRepositoryToken(ProviderService),
          useValue: providerServiceRepository,
        },
        { provide: getRepositoryToken(Booking), useValue: bookingRepository },
      ],
    }).compile();

    service = module.get(QuotesService);
    jest.clearAllMocks();

    jobRequestRepository.create.mockImplementation(
      (dto: Partial<JobRequest>) => ({ id: 'jr-new', ...dto }),
    );
    jobRequestRepository.save.mockImplementation((entity: JobRequest) =>
      Promise.resolve(entity),
    );
    quoteRepository.create.mockImplementation((dto: Partial<Quote>) => ({
      id: 'q-new',
      ...dto,
    }));
    quoteRepository.save.mockImplementation((entity: Quote) =>
      Promise.resolve(entity),
    );
  });

  describe('createJobRequest', () => {
    it('creates a job request for the customer', async () => {
      customerRepository.findOne.mockResolvedValue(mockCustomer);
      categoryRepository.findOne.mockResolvedValue(mockCategory);

      const result = await service.createJobRequest(
        { categoryId, title: 'Fix sink', description: 'Leaking' },
        customerUserId,
      );

      expect(result).toBeDefined();
      expect(result.status).toBe(JobRequestStatus.OPEN);
      expect(jobRequestRepository.save).toHaveBeenCalled();
    });

    it('throws NotFound when customer profile missing', async () => {
      customerRepository.findOne.mockResolvedValue(null);
      await expect(
        service.createJobRequest(
          { categoryId, title: 't', description: 'd' },
          customerUserId,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFound when category missing', async () => {
      customerRepository.findOne.mockResolvedValue(mockCustomer);
      categoryRepository.findOne.mockResolvedValue(null);
      await expect(
        service.createJobRequest(
          { categoryId, title: 't', description: 'd' },
          customerUserId,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('parses preferredDate from ISO string', async () => {
      customerRepository.findOne.mockResolvedValue(mockCustomer);
      categoryRepository.findOne.mockResolvedValue(mockCategory);
      await service.createJobRequest(
        {
          categoryId,
          title: 't',
          description: 'd',
          preferredDate: '2030-01-15T10:00:00Z',
        },
        customerUserId,
      );
      expect(jobRequestRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          preferredDate: new Date('2030-01-15T10:00:00Z'),
        }),
      );
    });
  });

  describe('findMyJobRequests', () => {
    it('returns empty when customer profile missing', async () => {
      customerRepository.findOne.mockResolvedValue(null);
      const result = await service.findMyJobRequests(customerUserId);
      expect(result).toEqual([]);
    });

    it('returns requests for the customer', async () => {
      customerRepository.findOne.mockResolvedValue(mockCustomer);
      jobRequestRepository.find.mockResolvedValue([mockJobRequest]);
      const result = await service.findMyJobRequests(customerUserId);
      expect(result).toEqual([mockJobRequest]);
    });
  });

  describe('findJobRequestById', () => {
    it('returns the request', async () => {
      jobRequestRepository.findOne.mockResolvedValue(mockJobRequest);
      const result = await service.findJobRequestById(jobRequestId);
      expect(result).toEqual(mockJobRequest);
    });

    it('throws NotFound when missing', async () => {
      jobRequestRepository.findOne.mockResolvedValue(null);
      await expect(service.findJobRequestById('x')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('cancelJobRequest', () => {
    it('cancels own request', async () => {
      jobRequestRepository.findOne.mockResolvedValue({ ...mockJobRequest });
      const result = await service.cancelJobRequest(
        jobRequestId,
        customerUserId,
      );
      expect(result.status).toBe(JobRequestStatus.CANCELLED);
    });

    it('forbids cancelling another user request', async () => {
      jobRequestRepository.findOne.mockResolvedValue(mockJobRequest);
      await expect(
        service.cancelJobRequest(jobRequestId, 'other-user'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws when already accepted', async () => {
      jobRequestRepository.findOne.mockResolvedValue({
        ...mockJobRequest,
        status: JobRequestStatus.ACCEPTED,
      });
      await expect(
        service.cancelJobRequest(jobRequestId, customerUserId),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws when already cancelled', async () => {
      jobRequestRepository.findOne.mockResolvedValue({
        ...mockJobRequest,
        status: JobRequestStatus.CANCELLED,
      });
      await expect(
        service.cancelJobRequest(jobRequestId, customerUserId),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws when already closed', async () => {
      jobRequestRepository.findOne.mockResolvedValue({
        ...mockJobRequest,
        status: JobRequestStatus.CLOSED,
      });
      await expect(
        service.cancelJobRequest(jobRequestId, customerUserId),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('createQuote', () => {
    it('creates a quote for an open job request', async () => {
      providerRepository.findOne.mockResolvedValue(mockProvider);
      jobRequestRepository.findOne.mockResolvedValue(mockJobRequest);
      quoteRepository.findOne.mockResolvedValue(null);

      const result = await service.createQuote(
        jobRequestId,
        { amount: 500, message: 'Can do' },
        providerUserId,
      );

      expect(result).toBeDefined();
      expect(result.amount).toBe(500);
      expect(quoteRepository.save).toHaveBeenCalled();
      // Job request moves to QUOTED on first quote
      expect(jobRequestRepository.save).toHaveBeenCalled();
    });

    it('throws NotFound when provider profile missing', async () => {
      providerRepository.findOne.mockResolvedValue(null);
      await expect(
        service.createQuote(jobRequestId, { amount: 500 }, providerUserId),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFound when job request missing', async () => {
      providerRepository.findOne.mockResolvedValue(mockProvider);
      jobRequestRepository.findOne.mockResolvedValue(null);
      await expect(
        service.createQuote(jobRequestId, { amount: 500 }, providerUserId),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequest when job request already accepted', async () => {
      providerRepository.findOne.mockResolvedValue(mockProvider);
      jobRequestRepository.findOne.mockResolvedValue({
        ...mockJobRequest,
        status: JobRequestStatus.ACCEPTED,
      });
      await expect(
        service.createQuote(jobRequestId, { amount: 500 }, providerUserId),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequest when provider already submitted a quote', async () => {
      providerRepository.findOne.mockResolvedValue(mockProvider);
      jobRequestRepository.findOne.mockResolvedValue(mockJobRequest);
      quoteRepository.findOne.mockResolvedValue(mockQuote);
      await expect(
        service.createQuote(jobRequestId, { amount: 500 }, providerUserId),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findMyQuotes', () => {
    it('returns empty when provider profile missing', async () => {
      providerRepository.findOne.mockResolvedValue(null);
      const result = await service.findMyQuotes(providerUserId);
      expect(result).toEqual([]);
    });

    it('returns quotes for provider', async () => {
      providerRepository.findOne.mockResolvedValue(mockProvider);
      quoteRepository.find.mockResolvedValue([mockQuote]);
      const result = await service.findMyQuotes(providerUserId);
      expect(result).toEqual([mockQuote]);
    });
  });

  describe('updateQuote', () => {
    it('updates own pending quote', async () => {
      quoteRepository.findOne.mockResolvedValue({
        ...mockQuote,
        provider: { ...mockProvider, user: { id: providerUserId } },
      });
      const result = await service.updateQuote(
        quoteId,
        { amount: 600, message: 'Updated' },
        providerUserId,
      );
      expect(result.amount).toBe(600);
      expect(quoteRepository.save).toHaveBeenCalled();
    });

    it('throws NotFound when missing', async () => {
      quoteRepository.findOne.mockResolvedValue(null);
      await expect(
        service.updateQuote(quoteId, { amount: 600 }, providerUserId),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws Forbidden when not owner', async () => {
      quoteRepository.findOne.mockResolvedValue({
        ...mockQuote,
        provider: { ...mockProvider, user: { id: 'other' } },
      });
      await expect(
        service.updateQuote(quoteId, { amount: 600 }, providerUserId),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequest when not pending', async () => {
      quoteRepository.findOne.mockResolvedValue({
        ...mockQuote,
        provider: { ...mockProvider, user: { id: providerUserId } },
        status: QuoteStatus.ACCEPTED,
      });
      await expect(
        service.updateQuote(quoteId, { amount: 600 }, providerUserId),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('withdrawQuote', () => {
    it('withdraws own pending quote', async () => {
      quoteRepository.findOne.mockResolvedValue({
        ...mockQuote,
        provider: { ...mockProvider, user: { id: providerUserId } },
      });
      const result = await service.withdrawQuote(quoteId, providerUserId);
      expect(result.status).toBe(QuoteStatus.WITHDRAWN);
    });

    it('throws Forbidden when not owner', async () => {
      quoteRepository.findOne.mockResolvedValue({
        ...mockQuote,
        provider: { ...mockProvider, user: { id: 'other' } },
      });
      await expect(
        service.withdrawQuote(quoteId, providerUserId),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequest when not pending', async () => {
      quoteRepository.findOne.mockResolvedValue({
        ...mockQuote,
        provider: { ...mockProvider, user: { id: providerUserId } },
        status: QuoteStatus.ACCEPTED,
      });
      await expect(
        service.withdrawQuote(quoteId, providerUserId),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('acceptQuote', () => {
    const quoteWithRelations = {
      ...mockQuote,
      jobRequest: {
        ...mockJobRequest,
        customer: { ...mockCustomer, user: { id: customerUserId } },
        category: mockCategory,
      },
      provider: mockProvider,
    };

    it('accepts quote and creates booking', async () => {
      quoteRepository.findOne.mockResolvedValue(quoteWithRelations);
      const updateQb = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue(undefined),
      };
      quoteRepository.createQueryBuilder.mockReturnValue(updateQb);
      providerServiceRepository.findOne.mockResolvedValue(null);
      bookingRepository.create.mockImplementation((dto: Partial<Booking>) => ({
        id: 'book-1',
        ...dto,
      }));
      bookingRepository.save.mockImplementation((entity: Booking) =>
        Promise.resolve(entity),
      );
      bookingRepository.findOne.mockResolvedValue({ id: 'book-1' });

      const result = await service.acceptQuote(quoteId, customerUserId);

      expect(result).toBeDefined();
      expect(quoteRepository.save).toHaveBeenCalled();
      expect(bookingRepository.save).toHaveBeenCalled();
      expect(jobRequestRepository.save).toHaveBeenCalled();
    });

    it('throws Forbidden when not the request owner', async () => {
      quoteRepository.findOne.mockResolvedValue(quoteWithRelations);
      await expect(service.acceptQuote(quoteId, 'other-user')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws BadRequest when quote already accepted', async () => {
      quoteRepository.findOne.mockResolvedValue({
        ...quoteWithRelations,
        status: QuoteStatus.ACCEPTED,
      });
      await expect(
        service.acceptQuote(quoteId, customerUserId),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequest when job request already closed', async () => {
      quoteRepository.findOne.mockResolvedValue({
        ...quoteWithRelations,
        jobRequest: {
          ...quoteWithRelations.jobRequest,
          status: JobRequestStatus.CLOSED,
        },
      });
      await expect(
        service.acceptQuote(quoteId, customerUserId),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
