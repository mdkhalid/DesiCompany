import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PushNotificationsService } from './push-notifications.service';
import { User } from '../users/entities/user.entity';
import { NotificationGateway } from '../notifications/notification.gateway';

describe('PushNotificationsService', () => {
  let service: PushNotificationsService;
  let notificationGateway: { sendNotification: jest.Mock };

  beforeEach(async () => {
    notificationGateway = { sendNotification: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PushNotificationsService,
        { provide: getRepositoryToken(User), useValue: { find: jest.fn(), findOne: jest.fn() } },
        { provide: NotificationGateway, useValue: notificationGateway },
      ],
    }).compile();

    service = module.get<PushNotificationsService>(PushNotificationsService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('sendToUser', () => {
    it('should call notificationGateway.sendNotification', async () => {
      await service.sendToUser('u1', 'Title', 'Body', { type: 'booking' });

      expect(notificationGateway.sendNotification).toHaveBeenCalledWith(
        'u1',
        'Title',
        'Body',
        'booking',
        { type: 'booking' },
        undefined,
      );
    });

    it('should default type to general when no data', async () => {
      await service.sendToUser('u1', 'Title', 'Body');

      expect(notificationGateway.sendNotification).toHaveBeenCalledWith(
        'u1',
        'Title',
        'Body',
        'general',
        undefined,
        undefined,
      );
    });
  });

  describe('sendToMultipleUsers', () => {
    it('should send to each user', async () => {
      await service.sendToMultipleUsers(['u1', 'u2', 'u3'], 'Title', 'Body');

      expect(notificationGateway.sendNotification).toHaveBeenCalledTimes(3);
    });
  });

  describe('registerToken', () => {
    it('should return WebSocket notification message', () => {
      const result = service.registerToken('u1', 'token-123');
      expect(result).toEqual({ message: 'Using WebSocket notifications' });
    });
  });
});
