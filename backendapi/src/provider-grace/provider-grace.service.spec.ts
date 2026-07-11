import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { ProviderGraceService } from './provider-grace.service';
import { Provider } from '../users/entities/provider.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { SettingsService } from '../settings/settings.service';
import { PushNotificationsService } from '../push-notifications/push-notifications.service';
import { NotificationsService } from '../notifications/notifications.service';

type MockRepo = {
  find: jest.Mock;
  findOne: jest.Mock;
  create: jest.Mock;
  save: jest.Mock;
  createQueryBuilder: jest.Mock;
};

function makeRepoMock(): MockRepo {
  return {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn(),
    create: jest.fn((x) => x),
    save: jest.fn((x) => Promise.resolve(x)),
    createQueryBuilder: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ total: '0' }),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    })),
  };
}

describe('ProviderGraceService', () => {
  let service: ProviderGraceService;
  let providerRepo: MockRepo;
  let bookingRepo: MockRepo;
  let settingsService: {
    isProviderGraceCommissionWaiverEnabled: jest.Mock;
    isProviderGracePeriodEnabled: jest.Mock;
    getProviderGracePeriodDays: jest.Mock;
  };
  let pushService: { sendToUser: jest.Mock };
  let notifService: { create: jest.Mock };

  beforeEach(async () => {
    providerRepo = makeRepoMock();
    bookingRepo = makeRepoMock();
    settingsService = {
      isProviderGraceCommissionWaiverEnabled: jest.fn().mockResolvedValue(true),
      isProviderGracePeriodEnabled: jest.fn().mockResolvedValue(true),
      getProviderGracePeriodDays: jest.fn().mockResolvedValue(7),
    };
    pushService = { sendToUser: jest.fn().mockResolvedValue(undefined) };
    notifService = { create: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProviderGraceService,
        { provide: getRepositoryToken(Provider), useValue: providerRepo },
        { provide: getRepositoryToken(Booking), useValue: bookingRepo },
        { provide: SettingsService, useValue: settingsService },
        { provide: PushNotificationsService, useValue: pushService },
        { provide: NotificationsService, useValue: notifService },
      ],
    }).compile();

    service = module.get<ProviderGraceService>(ProviderGraceService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('getGraceStatus', () => {
    it('should throw NotFoundException when provider not found', async () => {
      providerRepo.findOne.mockResolvedValue(null);

      await expect(service.getGraceStatus('u1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return grace status with computed dates', async () => {
      const createdAt = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000); // 3 days ago
      providerRepo.findOne.mockResolvedValue({
        providerCreatedAt: createdAt,
      });

      const result = await service.getGraceStatus('u1');
      expect(result.days).toBe(7);
      expect(result.commissionWaivedActive).toBe(true);
      expect(result.daysLeft).toBeGreaterThan(0);
    });
  });

  describe('sendWelcome', () => {
    it('should not send when grace commission waiver is disabled', async () => {
      settingsService.isProviderGraceCommissionWaiverEnabled.mockResolvedValue(false);

      await service.sendWelcome('u1');

      expect(notifService.create).not.toHaveBeenCalled();
      expect(pushService.sendToUser).not.toHaveBeenCalled();
    });

    it('should send notification and push when enabled', async () => {
      await service.sendWelcome('u1');

      expect(notifService.create).toHaveBeenCalled();
      expect(pushService.sendToUser).toHaveBeenCalled();
    });
  });
});
