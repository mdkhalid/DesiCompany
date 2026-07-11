import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { Booking } from './entities/booking.entity';
import { BookingCharge } from './entities/booking-charge.entity';
import { BookingServiceItem } from './entities/booking-service-item.entity';
import { Customer } from '../users/entities/customer.entity';
import { Provider } from '../users/entities/provider.entity';
import { ProviderService } from '../services/entities/provider-service.entity';
import { Message } from '../chat/entities/message.entity';
import { ProviderAvailability } from '../services/entities/provider-availability.entity';
import { ProviderDateOverride } from '../services/entities/provider-date-override.entity';
import { ProviderBusySlot } from '../services/entities/provider-busy-slot.entity';
import { JobRequest } from '../quotes/entities/job-request.entity';
import { ChatGateway } from '../chat/chat.gateway';
import { CommissionService } from '../commissions/commission.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationGateway } from '../notifications/notification.gateway';
import { PushNotificationsService } from '../push-notifications/push-notifications.service';
import { LoyaltyService } from '../loyalty/loyalty.service';
import { PlatformFeesService } from '../platform-fees/platform-fees.service';
import { BookingStatus } from '../common/enums/booking-status.enum';
import { UserRole } from '../common/enums/user-role.enum';

type MockRepo = {
  find: jest.Mock;
  findOne: jest.Mock;
  create: jest.Mock;
  save: jest.Mock;
  delete: jest.Mock;
  remove: jest.Mock;
  count: jest.Mock;
};

function makeRepoMock(): MockRepo {
  return {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn(),
    create: jest.fn((x) => x),
    save: jest.fn((x) => Promise.resolve(x)),
    delete: jest.fn(),
    remove: jest.fn().mockResolvedValue(undefined),
    count: jest.fn().mockResolvedValue(0),
  };
}

describe('BookingsService', () => {
  let service: BookingsService;
  let bookingRepo: MockRepo;
  let customerRepo: MockRepo;
  let providerRepo: MockRepo;
  let providerServiceRepo: MockRepo;
  let chargeRepo: MockRepo;
  let availabilityRepo: MockRepo;
  let dateOverrideRepo: MockRepo;
  let busySlotRepo: MockRepo;
  let chatGateway: { emitRoleSpecificSystemMessage: jest.Mock };
  let commissionService: { resolveCommission: jest.Mock };
  let notifService: { create: jest.Mock };
  let notifGateway: Record<string, never>;
  let pushService: { sendToUser: jest.Mock };
  let loyaltyService: { awardPointsForBooking: jest.Mock };
  let platformFeesService: { getConvenienceFee: jest.Mock };

  const mockBooking = (overrides: Record<string, any> = {}) => ({
    id: 'b1',
    status: BookingStatus.REQUESTED,
    scheduledDate: new Date('2026-07-15T10:00:00Z'),
    estimatedHours: 2,
    charges: [],
    serviceItems: [],
    quote: null,
    isEmergency: false,
    customer: {
      id: 'c1',
      firstName: 'John',
      lastName: 'Doe',
      user: { id: 'cu1' },
    },
    provider: {
      id: 'p1',
      firstName: 'Ravi',
      lastName: 'Kumar',
      isVerified: true,
      isSoftBlocked: false,
      user: { id: 'pu1' },
    },
    providerService: {
      id: 'ps1',
      pricingModel: 'hourly',
      hourlyRate: 500,
      category: { id: 'cat1' },
    },
    ...overrides,
  });

  beforeEach(async () => {
    bookingRepo = makeRepoMock();
    customerRepo = makeRepoMock();
    providerRepo = makeRepoMock();
    providerServiceRepo = makeRepoMock();
    chargeRepo = makeRepoMock();
    availabilityRepo = makeRepoMock();
    dateOverrideRepo = makeRepoMock();
    busySlotRepo = makeRepoMock();
    chatGateway = { emitRoleSpecificSystemMessage: jest.fn().mockResolvedValue(undefined) };
    commissionService = { resolveCommission: jest.fn().mockResolvedValue({ amount: 50, waived: false }) };
    notifService = { create: jest.fn().mockResolvedValue(undefined) };
    notifGateway = {};
    pushService = { sendToUser: jest.fn().mockResolvedValue(undefined) };
    loyaltyService = { awardPointsForBooking: jest.fn().mockResolvedValue(undefined) };
    platformFeesService = { getConvenienceFee: jest.fn().mockResolvedValue({ finalFee: 30 }) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingsService,
        { provide: getRepositoryToken(Booking), useValue: bookingRepo },
        { provide: getRepositoryToken(BookingCharge), useValue: chargeRepo },
        { provide: getRepositoryToken(Customer), useValue: customerRepo },
        { provide: getRepositoryToken(Provider), useValue: providerRepo },
        { provide: getRepositoryToken(ProviderService), useValue: providerServiceRepo },
        { provide: getRepositoryToken(BookingServiceItem), useValue: makeRepoMock() },
        { provide: getRepositoryToken(Message), useValue: makeRepoMock() },
        { provide: getRepositoryToken(ProviderAvailability), useValue: availabilityRepo },
        { provide: getRepositoryToken(ProviderDateOverride), useValue: dateOverrideRepo },
        { provide: getRepositoryToken(ProviderBusySlot), useValue: busySlotRepo },
        { provide: getRepositoryToken(JobRequest), useValue: makeRepoMock() },
        { provide: ChatGateway, useValue: chatGateway },
        { provide: CommissionService, useValue: commissionService },
        { provide: NotificationsService, useValue: notifService },
        { provide: NotificationGateway, useValue: notifGateway },
        { provide: PushNotificationsService, useValue: pushService },
        { provide: LoyaltyService, useValue: loyaltyService },
        { provide: PlatformFeesService, useValue: platformFeesService },
      ],
    }).compile();

    service = module.get<BookingsService>(BookingsService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('findOne', () => {
    it('should throw NotFoundException when booking not found', async () => {
      bookingRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne('b1')).rejects.toThrow(NotFoundException);
    });

    it('should return booking when found', async () => {
      const booking = mockBooking();
      bookingRepo.findOne.mockResolvedValue(booking);

      const result = await service.findOne('b1');
      expect(result.id).toBe('b1');
    });
  });

  describe('create', () => {
    it('should throw NotFoundException when customer not found', async () => {
      customerRepo.findOne.mockResolvedValue(null);

      await expect(
        service.create({
          customerId: 'c1',
          providerId: 'p1',
          providerServiceId: 'ps1',
          scheduledDate: '2026-07-15T10:00:00Z',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when provider not found', async () => {
      customerRepo.findOne.mockResolvedValue({ id: 'c1' });
      providerRepo.findOne.mockResolvedValue(null);

      await expect(
        service.create({
          customerId: 'c1',
          providerId: 'p1',
          providerServiceId: 'ps1',
          scheduledDate: '2026-07-15T10:00:00Z',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when provider not verified', async () => {
      customerRepo.findOne.mockResolvedValue({ id: 'c1' });
      providerRepo.findOne.mockResolvedValue({ id: 'p1', isVerified: false, isSoftBlocked: false });

      await expect(
        service.create({
          customerId: 'c1',
          providerId: 'p1',
          providerServiceId: 'ps1',
          scheduledDate: '2026-07-15T10:00:00Z',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when provider is soft blocked', async () => {
      customerRepo.findOne.mockResolvedValue({ id: 'c1' });
      providerRepo.findOne.mockResolvedValue({ id: 'p1', isVerified: true, isSoftBlocked: true });

      await expect(
        service.create({
          customerId: 'c1',
          providerId: 'p1',
          providerServiceId: 'ps1',
          scheduledDate: '2026-07-15T10:00:00Z',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateStatus', () => {
    it('should throw NotFoundException when booking not found', async () => {
      bookingRepo.findOne.mockResolvedValue(null);

      await expect(
        service.updateStatus('b1', { status: BookingStatus.ACCEPTED }, 'pu1', UserRole.PROVIDER),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for invalid transition', async () => {
      const booking = mockBooking({ status: BookingStatus.COMPLETED });
      bookingRepo.findOne.mockResolvedValue(booking);

      await expect(
        service.updateStatus('b1', { status: BookingStatus.ACCEPTED }, 'pu1', UserRole.PROVIDER),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ForbiddenException when customer tries provider-only status', async () => {
      const booking = mockBooking();
      bookingRepo.findOne.mockResolvedValue(booking);

      await expect(
        service.updateStatus('b1', { status: BookingStatus.ACCEPTED }, 'cu1', UserRole.CUSTOMER),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should accept a requested booking', async () => {
      const booking = mockBooking();
      bookingRepo.findOne.mockResolvedValue(booking);

      await service.updateStatus('b1', { status: BookingStatus.ACCEPTED }, 'pu1', UserRole.PROVIDER);

      expect(booking.status).toBe(BookingStatus.ACCEPTED);
      expect(bookingRepo.save).toHaveBeenCalled();
    });
  });

  describe('reschedule', () => {
    it('should throw BadRequestException for completed booking', async () => {
      const booking = mockBooking({ status: BookingStatus.COMPLETED });
      bookingRepo.findOne.mockResolvedValue(booking);

      await expect(
        service.reschedule('b1', { scheduledDate: '2026-07-20T10:00:00Z' }, 'cu1', UserRole.CUSTOMER),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reschedule a requested booking', async () => {
      const booking = mockBooking();
      bookingRepo.findOne.mockResolvedValue(booking);

      const result = await service.reschedule(
        'b1',
        { scheduledDate: '2026-07-20T10:00:00Z' },
        'cu1',
        UserRole.CUSTOMER,
      );

      expect(result.scheduledDate).toEqual(new Date('2026-07-20T10:00:00Z'));
    });
  });

  describe('findByCustomer', () => {
    it('should return bookings for a customer', async () => {
      const bookings = [mockBooking()];
      bookingRepo.find.mockResolvedValue(bookings);

      const result = await service.findByCustomer('c1');
      expect(result).toEqual(bookings);
    });
  });

  describe('findByProvider', () => {
    it('should return bookings for a provider', async () => {
      const bookings = [mockBooking()];
      bookingRepo.find.mockResolvedValue(bookings);

      const result = await service.findByProvider('p1');
      expect(result).toEqual(bookings);
    });
  });
});
