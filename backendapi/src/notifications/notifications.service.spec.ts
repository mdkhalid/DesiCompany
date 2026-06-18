import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, UpdateResult } from 'typeorm';
import { NotificationsService } from './notifications.service';
import { Notification } from './entities/notification.entity';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let repo: jest.Mocked<Repository<Notification>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        {
          provide: getRepositoryToken(Notification),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findAndCount: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn(),
            count: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(NotificationsService);
    repo = module.get(getRepositoryToken(Notification));
  });

  describe('create', () => {
    it('creates and saves a notification', async () => {
      repo.create.mockReturnValue({ id: 'notif-1' } as Notification);
      repo.save.mockResolvedValue({ id: 'notif-1' } as Notification);
      const result = await service.create('user-1', 'Title', 'Message');
      expect(result.id).toBe('notif-1');
    });
  });

  describe('findByUser', () => {
    it('returns paginated notifications', async () => {
      repo.findAndCount.mockResolvedValue([
        [{ id: 'n1', title: 'Test', message: 'Hello' } as any],
        1,
      ]);
      const result = await service.findByUser('user-1');
      expect(result.notifications).toHaveLength(1);
    });
  });

  describe('unreadCount', () => {
    it('returns count of unread notifications', async () => {
      repo.count.mockResolvedValue(3);
      const result = await service.getUnreadCount('user-1');
      expect(result).toBe(3);
    });
  });

  describe('markAsRead', () => {
    it('marks a notification as read', async () => {
      repo.update.mockResolvedValue({ affected: 1 } as UpdateResult);
      repo.findOne.mockResolvedValue({
        id: 'n1',
        isRead: true,
      } as Notification);
      const result = await service.markAsRead('n1', 'user-1');
      expect(result?.isRead).toBe(true);
    });
  });

  describe('markAllAsRead', () => {
    it('marks all as read', async () => {
      repo.update.mockResolvedValue({ affected: 5 } as UpdateResult);
      const result = await service.markAllAsRead('user-1');
      expect(result.success).toBe(true);
    });
  });
});
