import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { ServicesService } from './services.service';
import { ServiceCategory } from './entities/service-category.entity';
import { ProviderAvailability } from './entities/provider-availability.entity';
import { ProviderDateOverride } from './entities/provider-date-override.entity';
import { ProviderBusySlot } from './entities/provider-busy-slot.entity';
import { ProviderService } from './entities/provider-service.entity';
import { Provider } from '../users/entities/provider.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { BookingStatus } from '../common/enums/booking-status.enum';
import { SettingsService } from '../settings/settings.service';
import { PresenceService } from '../chat/presence.service';
import { PlatformFeesService } from '../platform-fees/platform-fees.service';
import { CacheService } from '../common/cache.service';

type MockRepo = {
  find: jest.Mock;
  findOne: jest.Mock;
  create: jest.Mock;
  save: jest.Mock;
  delete: jest.Mock;
  findAndCount: jest.Mock;
};

function makeRepoMock(): MockRepo {
  return {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
    findAndCount: jest.fn(),
  };
}

describe('ServicesService', () => {
  let service: ServicesService;
  let providerRepo: MockRepo;
  let availabilityRepo: MockRepo;
  let overrideRepo: MockRepo;
  let bookingRepo: MockRepo;
  let busySlotRepo: MockRepo;

  const providerId = 'prov-1';

  const mockProvider = { id: providerId, isSoftBlocked: false };

  beforeEach(async () => {
    providerRepo = makeRepoMock();
    availabilityRepo = makeRepoMock();
    overrideRepo = makeRepoMock();
    bookingRepo = makeRepoMock();
    busySlotRepo = makeRepoMock();
    // Default: no busy slots, no existing bookings
    busySlotRepo.find.mockResolvedValue([]);
    bookingRepo.find.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ServicesService,
        {
          provide: getRepositoryToken(ServiceCategory),
          useValue: makeRepoMock(),
        },
        { provide: getRepositoryToken(Provider), useValue: providerRepo },
        {
          provide: getRepositoryToken(ProviderAvailability),
          useValue: availabilityRepo,
        },
        {
          provide: getRepositoryToken(ProviderDateOverride),
          useValue: overrideRepo,
        },
        {
          provide: getRepositoryToken(ProviderService),
          useValue: makeRepoMock(),
        },
        { provide: getRepositoryToken(Booking), useValue: bookingRepo },
        {
          provide: getRepositoryToken(ProviderBusySlot),
          useValue: busySlotRepo,
        },
        {
          provide: SettingsService,
          useValue: { get: jest.fn().mockResolvedValue(null) },
        },
        {
          provide: PresenceService,
          useValue: {
            registerSocket: jest.fn(),
            unregisterSocket: jest.fn(),
            isUserOnline: jest.fn().mockReturnValue(false),
          },
        },
        {
          provide: PlatformFeesService,
          useValue: { getProviderSubscription: jest.fn().mockResolvedValue(null) },
        },
        {
          provide: CacheService,
          useValue: {
            get: jest.fn().mockResolvedValue(null),
            set: jest.fn().mockResolvedValue(undefined),
            del: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get<ServicesService>(ServicesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getAvailableSlots', () => {
    it('should throw NotFoundException when provider not found', async () => {
      providerRepo.findOne.mockResolvedValue(null);
      await expect(
        service.getAvailableSlots(providerId, '2026-07-01'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should return unavailable when override exists with isAvailable false', async () => {
      providerRepo.findOne.mockResolvedValue(mockProvider);
      overrideRepo.findOne.mockResolvedValue({
        isAvailable: false,
        reason: 'Holiday',
        startTime: null,
        endTime: null,
      });

      const result = await service.getAvailableSlots(providerId, '2026-07-01');
      expect(result.available).toBe(false);
      expect(result.reason).toBe('Holiday');
      expect(result.slots).toEqual([]);
    });

    it('should return slots from override hours when override has custom times', async () => {
      providerRepo.findOne.mockResolvedValue(mockProvider);
      overrideRepo.findOne.mockResolvedValue({
        isAvailable: true,
        startTime: '10:00',
        endTime: '12:00',
        reason: null,
      });
      bookingRepo.find.mockResolvedValue([]);

      const result = await service.getAvailableSlots(providerId, '2026-07-01');
      expect(result.available).toBe(true);
      expect(result.slots.length).toBe(2);
      expect(result.slots[0].start).toBe('10:00');
      expect(result.slots[1].start).toBe('11:00');
    });

    it('should return unavailable when no availability for that day', async () => {
      providerRepo.findOne.mockResolvedValue(mockProvider);
      overrideRepo.findOne.mockResolvedValue(null);
      availabilityRepo.find.mockResolvedValue([]);

      const result = await service.getAvailableSlots(providerId, '2026-07-01');
      expect(result.available).toBe(false);
      expect(result.slots).toEqual([]);
    });

    it('should exclude booked slots from available slots', async () => {
      const wednesday = '2026-07-01';
      providerRepo.findOne.mockResolvedValue(mockProvider);
      overrideRepo.findOne.mockResolvedValue(null);
      availabilityRepo.find.mockResolvedValue([
        { startTime: '09:00', endTime: '12:00' },
      ]);
      // Use a Date object with explicit local hours so getHours() = 10 on this machine.
      // The service uses bDate.getHours() (local time), so we must match that.
      const bookedAt = new Date('2026-07-01');
      bookedAt.setHours(10, 0, 0, 0); // 10:00 local time
      bookingRepo.find.mockResolvedValue([
        { id: 'b-1', scheduledDate: bookedAt, estimatedHours: 1 },
      ]);

      const result = await service.getAvailableSlots(providerId, wednesday);
      expect(result.available).toBe(true);
      const slots: { start: string; booked: boolean }[] = result.slots;
      const bookedSlot = slots.find((s) => s.start === '10:00');
      expect(bookedSlot?.booked).toBe(true);
      // 09:00 and 11:00 should be available (not booked)
      expect(slots.find((s) => s.start === '09:00')?.booked).toBe(false);
      expect(slots.find((s) => s.start === '11:00')?.booked).toBe(false);
    });

    it('should return available slots when no bookings conflict', async () => {
      const wednesday = '2026-07-01';
      providerRepo.findOne.mockResolvedValue(mockProvider);
      overrideRepo.findOne.mockResolvedValue(null);
      availabilityRepo.find.mockResolvedValue([
        { startTime: '09:00', endTime: '11:00' },
      ]);
      bookingRepo.find.mockResolvedValue([]);

      const result = await service.getAvailableSlots(providerId, wednesday);
      expect(result.available).toBe(true);
      expect(result.slots).toHaveLength(2);
      expect(result.slots[0].start).toBe('09:00');
      expect(result.slots[1].start).toBe('10:00');
    });
  });

  describe('setWeeklySchedule', () => {
    it('should throw NotFoundException when provider not found', async () => {
      providerRepo.findOne.mockResolvedValue(null);
      await expect(service.setWeeklySchedule(providerId, [])).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException when startTime >= endTime', async () => {
      providerRepo.findOne.mockResolvedValue(mockProvider);
      await expect(
        service.setWeeklySchedule(providerId, [
          { dayOfWeek: 1, startTime: '14:00', endTime: '09:00' },
        ]),
      ).rejects.toThrow(BadRequestException);
    });

    it('should delete all existing slots and save new ones', async () => {
      providerRepo.findOne.mockResolvedValue(mockProvider);
      availabilityRepo.delete.mockResolvedValue({ affected: 0 });
      availabilityRepo.create
        .mockReturnValueOnce({
          dayOfWeek: 1,
          startTime: '09:00',
          endTime: '12:00',
        })
        .mockReturnValueOnce({
          dayOfWeek: 3,
          startTime: '10:00',
          endTime: '14:00',
        });
      availabilityRepo.save.mockResolvedValue([]);

      await service.setWeeklySchedule(providerId, [
        { dayOfWeek: 1, startTime: '09:00', endTime: '12:00' },
        { dayOfWeek: 3, startTime: '10:00', endTime: '14:00' },
      ]);

      expect(availabilityRepo.delete).toHaveBeenCalledWith({
        provider: { id: providerId },
      });
      expect(availabilityRepo.create).toHaveBeenCalledTimes(2);
      expect(availabilityRepo.save).toHaveBeenCalledTimes(1);
    });

    it('should return empty array when slots list is empty', async () => {
      providerRepo.findOne.mockResolvedValue(mockProvider);
      availabilityRepo.delete.mockResolvedValue({ affected: 0 });

      const result = await service.setWeeklySchedule(providerId, []);
      expect(result).toEqual([]);
      expect(availabilityRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('generateTimeSlotRanges', () => {
    it('should generate hourly slots between start and end', () => {
      const slots = service.generateTimeSlotRanges('09:00', '12:00', 60);
      expect(slots).toHaveLength(3);
      expect(slots[0]).toEqual({
        start: '09:00',
        end: '10:00',
        startMin: 540,
        endMin: 600,
      });
      expect(slots[1]).toEqual({
        start: '10:00',
        end: '11:00',
        startMin: 600,
        endMin: 660,
      });
      expect(slots[2]).toEqual({
        start: '11:00',
        end: '12:00',
        startMin: 660,
        endMin: 720,
      });
    });

    it('should generate 30-minute slots when duration is 30', () => {
      const slots = service.generateTimeSlotRanges('10:00', '11:00', 30);
      expect(slots).toHaveLength(2);
      expect(slots[0].start).toBe('10:00');
      expect(slots[1].start).toBe('10:30');
    });

    it('should return empty array when start equals end', () => {
      const slots = service.generateTimeSlotRanges('10:00', '10:00', 60);
      expect(slots).toEqual([]);
    });
  });
});
