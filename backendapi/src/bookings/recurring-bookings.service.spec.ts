import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { RecurringBookingsService } from './recurring-bookings.service';
import {
  RecurringBooking,
  RecurrenceFrequency,
  RecurrenceStatus,
} from './entities/recurring-booking.entity';
import { Booking } from './entities/booking.entity';
import { Customer } from '../users/entities/customer.entity';
import { Provider } from '../users/entities/provider.entity';
import { ProviderService } from '../services/entities/provider-service.entity';
import { UserRole } from '../common/enums/user-role.enum';

type MockRepo = {
  find: jest.Mock;
  findOne: jest.Mock;
  create: jest.Mock;
  save: jest.Mock;
};

function makeRepoMock(): MockRepo {
  return {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn(),
    create: jest.fn((x) => x),
    save: jest.fn((x) => Promise.resolve(x)),
  };
}

describe('RecurringBookingsService', () => {
  let service: RecurringBookingsService;
  let recurringRepo: MockRepo;
  let bookingRepo: MockRepo;
  let customerRepo: MockRepo;
  let providerRepo: MockRepo;
  let providerServiceRepo: MockRepo;

  beforeEach(async () => {
    recurringRepo = makeRepoMock();
    bookingRepo = makeRepoMock();
    customerRepo = makeRepoMock();
    providerRepo = makeRepoMock();
    providerServiceRepo = makeRepoMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecurringBookingsService,
        { provide: getRepositoryToken(RecurringBooking), useValue: recurringRepo },
        { provide: getRepositoryToken(Booking), useValue: bookingRepo },
        { provide: getRepositoryToken(Customer), useValue: customerRepo },
        { provide: getRepositoryToken(Provider), useValue: providerRepo },
        { provide: getRepositoryToken(ProviderService), useValue: providerServiceRepo },
      ],
    }).compile();

    service = module.get<RecurringBookingsService>(RecurringBookingsService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('create', () => {
    it('should throw NotFoundException when customer not found', async () => {
      customerRepo.findOne.mockResolvedValue(null);

      await expect(
        service.create('u1', {
          providerId: 'p1',
          providerServiceId: 'ps1',
          frequency: RecurrenceFrequency.WEEKLY,
          dayOfWeek: 1,
          startDate: '2026-07-15',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when provider not found', async () => {
      customerRepo.findOne.mockResolvedValue({ id: 'c1' });
      providerRepo.findOne.mockResolvedValue(null);

      await expect(
        service.create('u1', {
          providerId: 'p1',
          providerServiceId: 'ps1',
          frequency: RecurrenceFrequency.WEEKLY,
          dayOfWeek: 1,
          startDate: '2026-07-15',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for weekly without dayOfWeek', async () => {
      customerRepo.findOne.mockResolvedValue({ id: 'c1' });
      providerRepo.findOne.mockResolvedValue({ id: 'p1' });
      providerServiceRepo.findOne.mockResolvedValue({ id: 'ps1' });

      await expect(
        service.create('u1', {
          providerId: 'p1',
          providerServiceId: 'ps1',
          frequency: RecurrenceFrequency.WEEKLY,
          startDate: '2026-07-15',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create recurring booking successfully', async () => {
      customerRepo.findOne.mockResolvedValue({ id: 'c1' });
      providerRepo.findOne.mockResolvedValue({ id: 'p1' });
      providerServiceRepo.findOne.mockResolvedValue({ id: 'ps1' });

      const result = await service.create('u1', {
        providerId: 'p1',
        providerServiceId: 'ps1',
        frequency: RecurrenceFrequency.WEEKLY,
        dayOfWeek: 1,
        startDate: '2026-07-15',
        preferredTime: '10:00',
      });

      expect(result.status).toBe(RecurrenceStatus.ACTIVE);
      expect(recurringRepo.save).toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return all for admin', async () => {
      recurringRepo.find.mockResolvedValue([{ id: 'rb1' }]);

      const result = await service.findAll('admin-id', UserRole.ADMIN);
      expect(result).toHaveLength(1);
    });

    it('should return empty array when customer not found', async () => {
      customerRepo.findOne.mockResolvedValue(null);

      const result = await service.findAll('u1', UserRole.CUSTOMER);
      expect(result).toEqual([]);
    });

    it('should return empty array when provider not found', async () => {
      providerRepo.findOne.mockResolvedValue(null);

      const result = await service.findAll('u1', UserRole.PROVIDER);
      expect(result).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('should throw NotFoundException when not found', async () => {
      recurringRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne('rb1')).rejects.toThrow(NotFoundException);
    });

    it('should return recurring booking when found', async () => {
      const rb = { id: 'rb1', status: RecurrenceStatus.ACTIVE };
      recurringRepo.findOne.mockResolvedValue(rb);

      const result = await service.findOne('rb1');
      expect(result.id).toBe('rb1');
    });
  });

  describe('updateStatus', () => {
    it('should throw ForbiddenException when access denied', async () => {
      recurringRepo.findOne.mockResolvedValue({
        id: 'rb1',
        customer: { user: { id: 'other-user' } },
        provider: { user: { id: 'other-provider' } },
      });

      await expect(
        service.updateStatus('rb1', {}, 'u1', UserRole.CUSTOMER),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should update status for admin', async () => {
      const rb = { id: 'rb1', status: RecurrenceStatus.ACTIVE };
      recurringRepo.findOne.mockResolvedValue(rb);

      await service.updateStatus(
        'rb1',
        { status: RecurrenceStatus.PAUSED },
        'admin-id',
        UserRole.ADMIN,
      );

      expect(rb.status).toBe(RecurrenceStatus.PAUSED);
      expect(recurringRepo.save).toHaveBeenCalled();
    });
  });
});
