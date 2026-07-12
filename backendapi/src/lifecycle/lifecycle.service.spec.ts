import { Test, TestingModule } from '@nestjs/testing';
import { LifecycleService } from './lifecycle.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Notification } from '../notifications/entities/notification.entity';
import { Message } from '../chat/entities/message.entity';
import { DirectMessage } from '../chat/entities/direct-message.entity';
import { Repository } from 'typeorm';
import { Logger } from '@nestjs/common';

describe('LifecycleService', () => {
  let service: LifecycleService;
  let notificationRepo: jest.Mocked<Repository<Notification>>;
  let messageRepo: jest.Mocked<Repository<Message>>;
  let dmRepo: jest.Mocked<Repository<DirectMessage>>;

  beforeEach(async () => {
    notificationRepo = {
      createQueryBuilder: jest.fn(),
    } as any;
    messageRepo = {
      createQueryBuilder: jest.fn(),
    } as any;
    dmRepo = {
      createQueryBuilder: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LifecycleService,
        { provide: getRepositoryToken(Notification), useValue: notificationRepo },
        { provide: getRepositoryToken(Message), useValue: messageRepo },
        { provide: getRepositoryToken(DirectMessage), useValue: dmRepo },
      ],
    }).compile();

    service = module.get(LifecycleService);
  });

  it('pruneOldNotifications should delete old notifications', async () => {
    const mockQB = {
      delete: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 3 }),
    };
    notificationRepo.createQueryBuilder.mockReturnValue(mockQB as any);

    const result = await service.pruneOldNotifications();
    expect(result).toBe(3);
  });

  it('archiveOldMessages should mark old messages and DMs', async () => {
    const mockChatQB = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 10 }),
    };
    const mockDmQB = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 5 }),
    };
    messageRepo.createQueryBuilder.mockReturnValue(mockChatQB as any);
    dmRepo.createQueryBuilder.mockReturnValue(mockDmQB as any);

    const result = await service.archiveOldMessages();
    expect(result).toEqual({ chat: 10, dm: 5 });
  });
});
