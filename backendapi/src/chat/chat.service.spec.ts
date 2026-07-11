import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ChatService } from './chat.service';
import { Message } from './entities/message.entity';
import { DirectMessage } from './entities/direct-message.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { User } from '../users/entities/user.entity';
import { Provider } from '../users/entities/provider.entity';
import { Customer } from '../users/entities/customer.entity';
import { PresenceService } from './presence.service';

type MockRepo = {
  find: jest.Mock;
  findOne: jest.Mock;
  create: jest.Mock;
  save: jest.Mock;
  update: jest.Mock;
  remove: jest.Mock;
  findAndCount: jest.Mock;
  createQueryBuilder: jest.Mock;
};

function makeRepoMock(): MockRepo {
  const qb: any = {
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    distinctOn: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue([]),
    getRawMany: jest.fn().mockResolvedValue([]),
  };
  return {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn(),
    create: jest.fn((x) => x),
    save: jest.fn((x) => Promise.resolve(x)),
    update: jest.fn().mockResolvedValue(undefined),
    remove: jest.fn().mockResolvedValue(undefined),
    findAndCount: jest.fn().mockResolvedValue([[], 0]),
    createQueryBuilder: jest.fn().mockReturnValue(qb),
  };
}

describe('ChatService', () => {
  let service: ChatService;
  let messageRepo: MockRepo;
  let dmRepo: MockRepo;
  let bookingRepo: MockRepo;
  let userRepo: MockRepo;
  let providerRepo: MockRepo;
  let customerRepo: MockRepo;
  let presenceService: { isUserOnline: jest.Mock };

  beforeEach(async () => {
    messageRepo = makeRepoMock();
    dmRepo = makeRepoMock();
    bookingRepo = makeRepoMock();
    userRepo = makeRepoMock();
    providerRepo = makeRepoMock();
    customerRepo = makeRepoMock();
    presenceService = { isUserOnline: jest.fn().mockReturnValue(false) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        { provide: getRepositoryToken(Message), useValue: messageRepo },
        { provide: getRepositoryToken(DirectMessage), useValue: dmRepo },
        { provide: getRepositoryToken(Booking), useValue: bookingRepo },
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: getRepositoryToken(Provider), useValue: providerRepo },
        { provide: getRepositoryToken(Customer), useValue: customerRepo },
        { provide: PresenceService, useValue: presenceService },
      ],
    }).compile();

    service = module.get<ChatService>(ChatService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('getConversations', () => {
    it('should return empty when user not found', async () => {
      userRepo.findOne.mockResolvedValue(null);
      const result = await service.getConversations('u1');
      expect(result.conversations).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('should return empty when user has no role', async () => {
      userRepo.findOne.mockResolvedValue({ id: 'u1', customer: null, provider: null });
      const result = await service.getConversations('u1');
      expect(result.conversations).toHaveLength(0);
    });
  });

  describe('sendMessage', () => {
    it('should create a booking message', async () => {
      const savedMsg = { id: 'msg-1', content: 'Hello' };
      messageRepo.save.mockResolvedValue(savedMsg);

      const result = await service.sendMessage('u1', 'booking', 'b1', 'Hello');
      expect(messageRepo.create).toHaveBeenCalled();
      expect(messageRepo.save).toHaveBeenCalled();
      expect(result).toEqual(savedMsg);
    });

    it('should throw for invalid direct room ID', async () => {
      await expect(
        service.sendMessage('u1', 'direct', 'invalid', 'Hello'),
      ).rejects.toThrow('Invalid direct chat room ID');
    });

    it('should create a direct message for valid room ID', async () => {
      customerRepo.findOne.mockResolvedValue({ id: 'cust-1' });
      providerRepo.findOne.mockResolvedValue({ id: 'prov-1' });
      const savedDm = { id: 'dm-1', content: 'Hi' };
      dmRepo.save.mockResolvedValue(savedDm);

      const result = await service.sendMessage(
        'u1',
        'direct',
        'direct_u1_prov-1',
        'Hi',
      );
      expect(dmRepo.create).toHaveBeenCalled();
      expect(dmRepo.save).toHaveBeenCalled();
      expect(result).toEqual(savedDm);
    });

    it('should throw when customer not found in direct message', async () => {
      customerRepo.findOne.mockResolvedValue(null);
      await expect(
        service.sendMessage('u1', 'direct', 'direct_u1_prov-1', 'Hi'),
      ).rejects.toThrow('Customer not found');
    });

    it('should throw when provider not found in direct message', async () => {
      customerRepo.findOne.mockResolvedValue({ id: 'cust-1' });
      providerRepo.findOne.mockResolvedValue(null);
      await expect(
        service.sendMessage('u1', 'direct', 'direct_u1_prov-1', 'Hi'),
      ).rejects.toThrow('Provider not found');
    });
  });

  describe('getMessageHistory', () => {
    it('should return booking messages', async () => {
      messageRepo.findAndCount.mockResolvedValue([
        [{ id: 'm1', content: 'Hi', sender: null, booking: { id: 'b1' } }],
        1,
      ]);
      const result = await service.getMessageHistory('u1', 'booking', 'b1');
      expect(result.messages).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should return empty for invalid direct room', async () => {
      const result = await service.getMessageHistory('u1', 'direct', 'bad_room');
      expect(result.messages).toHaveLength(0);
    });

    it('should return empty when customer entity not found for direct', async () => {
      customerRepo.findOne.mockResolvedValue(null);
      const result = await service.getMessageHistory(
        'u1',
        'direct',
        'direct_u1_prov1',
      );
      expect(result.messages).toHaveLength(0);
    });

    it('should return empty when provider entity not found for direct', async () => {
      customerRepo.findOne.mockResolvedValue({ id: 'cust-1' });
      providerRepo.findOne.mockResolvedValue(null);
      const result = await service.getMessageHistory(
        'u1',
        'direct',
        'direct_u1_prov1',
      );
      expect(result.messages).toHaveLength(0);
    });

    it('should return direct messages when entities found', async () => {
      customerRepo.findOne.mockResolvedValue({ id: 'cust-1' });
      providerRepo.findOne.mockResolvedValue({ id: 'prov-1' });
      dmRepo.findAndCount.mockResolvedValue([
        [{
          id: 'dm-1',
          content: 'Hello',
          sender: { id: 'u1', customer: null, provider: null, role: 'customer' },
          customer: { id: 'cust-1' },
          provider: { id: 'prov-1' },
        }],
        1,
      ]);
      const result = await service.getMessageHistory(
        'u1',
        'direct',
        'direct_u1_prov-1',
      );
      expect(result.messages).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  describe('markAsRead', () => {
    it('should call update for booking messages', async () => {
      await service.markAsRead('u1', 'booking', 'b1');
      expect(messageRepo.update).toHaveBeenCalled();
    });

    it('should return silently for invalid direct room', async () => {
      await service.markAsRead('u1', 'direct', 'bad');
      expect(dmRepo.update).not.toHaveBeenCalled();
    });

    it('should return silently when customer not found for direct', async () => {
      customerRepo.findOne.mockResolvedValue(null);
      await service.markAsRead('u1', 'direct', 'direct_u1_prov1');
      expect(dmRepo.update).not.toHaveBeenCalled();
    });

    it('should call update for valid direct message', async () => {
      customerRepo.findOne.mockResolvedValue({ id: 'cust-1' });
      await service.markAsRead('u1', 'direct', 'direct_u1_prov1');
      expect(dmRepo.update).toHaveBeenCalled();
    });
  });

  describe('migrateDirectToBooking', () => {
    it('should return 0 when no direct messages found', async () => {
      dmRepo.find.mockResolvedValue([]);
      const result = await service.migrateDirectToBooking('cust-1', 'prov-1', 'b1');
      expect(result).toBe(0);
    });

    it('should return 0 when booking not found', async () => {
      dmRepo.find.mockResolvedValue([{ id: 'dm-1', sender: {}, content: 'hi' }]);
      bookingRepo.findOne.mockResolvedValue(null);
      const result = await service.migrateDirectToBooking('cust-1', 'prov-1', 'b1');
      expect(result).toBe(0);
    });

    it('should migrate messages to booking', async () => {
      const booking = { id: 'b1' };
      dmRepo.find.mockResolvedValue([
        { id: 'dm-1', sender: { id: 'u1' }, content: 'Hi', messageType: 'text', metadata: null, isRead: true, createdAt: new Date() },
      ]);
      bookingRepo.findOne.mockResolvedValue(booking);
      messageRepo.save.mockImplementation((m) => Promise.resolve(m));

      const result = await service.migrateDirectToBooking('cust-1', 'prov-1', 'b1');
      expect(result).toBe(1);
      expect(messageRepo.create).toHaveBeenCalled();
      expect(messageRepo.save).toHaveBeenCalled();
    });
  });

  describe('searchConversations', () => {
    it('should filter conversations by query', async () => {
      userRepo.findOne.mockResolvedValue({ id: 'u1', customer: { id: 'c1' }, provider: null, role: 'customer' });
      bookingRepo.find.mockResolvedValue([]);
      dmRepo.createQueryBuilder().getMany.mockResolvedValue([]);

      const result = await service.searchConversations('u1', 'xyz');
      expect(Array.isArray(result)).toBe(true);
    });
  });
});
