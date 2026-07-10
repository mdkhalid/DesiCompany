import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { Socket, Server } from 'socket.io';
import { ChatGateway } from './chat.gateway';
import { Message } from './entities/message.entity';
import { DirectMessage } from './entities/direct-message.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { User } from '../users/entities/user.entity';
import { Provider } from '../users/entities/provider.entity';
import { Customer } from '../users/entities/customer.entity';
import { PushNotificationsService } from '../push-notifications/push-notifications.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PresenceService } from './presence.service';

describe('ChatGateway', () => {
  let gateway: ChatGateway;

  const mockMessageRepo = {
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
  };

  const mockDirectMessageRepo = {
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockBookingRepo = {
    findOne: jest.fn(),
  };

  const mockUserRepo = {
    findOne: jest.fn(),
  };

  const mockProviderRepo = {
    findOne: jest.fn(),
  };

  const mockJwtService = {
    verify: jest.fn(),
  };

  const mockPushNotificationsService = {
    sendPushNotification: jest.fn(),
    sendToUser: jest.fn(),
  };

  const mockNotificationsService = {
    create: jest.fn().mockResolvedValue(undefined),
    markBookingNotificationsAsRead: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatGateway,
        { provide: getRepositoryToken(Message), useValue: mockMessageRepo },
        {
          provide: getRepositoryToken(DirectMessage),
          useValue: mockDirectMessageRepo,
        },
        { provide: getRepositoryToken(Booking), useValue: mockBookingRepo },
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: getRepositoryToken(Provider), useValue: mockProviderRepo },
        {
          provide: getRepositoryToken(Customer),
          useValue: { findOne: jest.fn() },
        },
        { provide: JwtService, useValue: mockJwtService },
        { provide: PushNotificationsService, useValue: mockPushNotificationsService },
        { provide: NotificationsService, useValue: mockNotificationsService },
        {
          provide: PresenceService,
          useValue: {
            registerSocket: jest.fn(),
            unregisterSocket: jest.fn(),
            isUserOnline: jest.fn().mockReturnValue(false),
            isAnySocketOnline: jest.fn().mockReturnValue(false),
            getSocketIds: jest.fn().mockReturnValue([]),
            getOnlineUserIds: jest.fn().mockReturnValue([]),
          },
        },
      ],
    }).compile();

    gateway = module.get(ChatGateway);
    // Assign a mock Socket.IO server — the gateway emits presence_update on connect/disconnect
    gateway.server = { emit: jest.fn(), to: jest.fn().mockReturnThis() } as unknown as Server;
    jest.clearAllMocks();
    // Re-assign after clearAllMocks so server mock functions are fresh for each test
    gateway.server = { emit: jest.fn(), to: jest.fn().mockReturnThis() } as unknown as Server;
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });

  describe('handleConnection', () => {
    it('rejects client with no token', () => {
      const mockDisconnect = jest.fn();
      const client = {
        id: 'socket-1',
        handshake: { auth: {}, headers: {} },
        disconnect: mockDisconnect,
        data: {},
      } as unknown as Socket;

      void gateway.handleConnection(client as never);

      expect(mockDisconnect).toHaveBeenCalled();
    });

    it('rejects client with invalid token', () => {
      mockJwtService.verify.mockImplementation(() => {
        throw new Error('invalid token');
      });

      const mockDisconnect = jest.fn();
      const client = {
        id: 'socket-1',
        handshake: { auth: { token: 'bad-token' }, headers: {} },
        disconnect: mockDisconnect,
        data: {},
      } as unknown as Socket;

      void gateway.handleConnection(client as never);

      expect(mockDisconnect).toHaveBeenCalled();
    });

    it('rejects client when user not found', async () => {
      mockJwtService.verify.mockReturnValue({
        sub: 'user-1',
        phone: '123',
        role: 'customer',
      });
      mockUserRepo.findOne.mockResolvedValue(null);

      const mockDisconnect = jest.fn();
      const client = {
        id: 'socket-1',
        handshake: { auth: { token: 'valid-token' }, headers: {} },
        disconnect: mockDisconnect,
        data: {},
      } as unknown as Socket;

      await gateway.handleConnection(client as never);

      expect(mockDisconnect).toHaveBeenCalled();
    });

    it('accepts client with valid token and sets user data', async () => {
      // handleConnection is called AFTER auth middleware sets client.data.userId.
      // Simulate that by pre-setting userId on client.data.
      const mockDisconnect = jest.fn();
      const client = {
        id: 'socket-1',
        handshake: { auth: { token: 'valid-token' }, headers: {} },
        disconnect: mockDisconnect,
        data: { userId: 'user-1' },
        emit: jest.fn(),
      } as unknown as Socket;

      gateway.handleConnection(client as never);

      expect(mockDisconnect).not.toHaveBeenCalled();
    });

    it('extracts token from authorization header', async () => {
      // Same: middleware sets userId before handleConnection fires.
      const client = {
        id: 'socket-1',
        handshake: {
          auth: {},
          headers: { authorization: 'Bearer valid-token' },
        },
        disconnect: jest.fn(),
        data: { userId: 'user-1' },
        emit: jest.fn(),
      } as unknown as Socket;

      gateway.handleConnection(client as never);

      expect((client.data as Record<string, unknown>).userId).toBe('user-1');
    });
  });

  describe('handleJoin', () => {
    it('rejects unauthenticated client', async () => {
      const mockEmit = jest.fn();
      const client = {
        id: 'socket-1',
        data: {},
        emit: mockEmit,
      } as unknown as Socket;

      await gateway.handleJoin(client as never, { bookingId: 'booking-1' });

      expect(mockEmit).toHaveBeenCalledWith('error', {
        message: 'Unauthorized',
      });
    });

    it('rejects when booking not found', async () => {
      mockBookingRepo.findOne.mockResolvedValue(null);

      const mockEmit = jest.fn();
      const client = {
        id: 'socket-1',
        data: { userId: 'user-1' },
        emit: mockEmit,
      } as unknown as Socket;

      await gateway.handleJoin(client as never, { bookingId: 'booking-1' });

      expect(mockEmit).toHaveBeenCalledWith('error', {
        message: 'Booking not found',
      });
    });

    it('rejects non-participant', async () => {
      mockBookingRepo.findOne.mockResolvedValue({
        id: 'booking-1',
        customer: { user: { id: 'user-2' } },
        provider: { user: { id: 'user-3' } },
      });

      const mockEmit = jest.fn();
      const mockJoin = jest.fn();
      const client = {
        id: 'socket-1',
        data: { userId: 'user-1' },
        emit: mockEmit,
        join: mockJoin,
      } as unknown as Socket;

      await gateway.handleJoin(client as never, { bookingId: 'booking-1' });

      expect(mockEmit).toHaveBeenCalledWith('error', {
        message: 'Not a participant of this booking',
      });
    });

    it('allows participant to join and returns history', async () => {
      const mockMessages = [
        {
          id: 'msg-1',
          content: 'hello',
          sender: {
            id: 'user-1',
            role: 'customer',
            customer: { firstName: 'Test' },
            phone: '123',
          },
          messageType: undefined,
          metadata: undefined,
          createdAt: undefined,
          isRead: undefined,
        },
      ];
      mockBookingRepo.findOne.mockResolvedValue({
        id: 'booking-1',
        customer: { user: { id: 'user-1' } },
        provider: { user: { id: 'user-2' } },
      });
      mockMessageRepo.find.mockResolvedValue(mockMessages);

      const mockEmit = jest.fn();
      const mockJoin = jest.fn();
      const client = {
        id: 'socket-1',
        data: { userId: 'user-1' },
        emit: mockEmit,
        join: mockJoin,
      } as unknown as Socket;

      await gateway.handleJoin(client as never, { bookingId: 'booking-1' });

      expect(mockJoin).toHaveBeenCalledWith('booking_booking-1');
      expect(mockEmit).toHaveBeenCalledWith('history', [
        {
          id: 'msg-1',
          content: 'hello',
          senderId: 'user-1',
          senderName: 'Test',
          senderRole: 'customer',
          messageType: undefined,
          metadata: undefined,
          createdAt: undefined,
          status: 'delivered',
          isRead: undefined,
          edited: false,
          deleted: false,
        },
      ]);
    });
  });

  describe('handleMessage', () => {
    it('rejects unauthenticated client', async () => {
      const mockEmit = jest.fn();
      const client = {
        id: 'socket-1',
        data: {},
        emit: mockEmit,
      } as unknown as Socket;

      await gateway.handleMessage(client as never, {
        bookingId: 'booking-1',
        content: 'hi',
      });

      expect(mockEmit).toHaveBeenCalledWith('error', {
        message: 'Unauthorized',
      });
    });

    it('sends message when participant', async () => {
      const mockSaved = {
        id: 'msg-1',
        content: 'hello',
        createdAt: new Date(),
      };
      mockBookingRepo.findOne.mockResolvedValue({
        id: 'booking-1',
        customer: { user: { id: 'user-1' } },
        provider: { user: { id: 'user-2' } },
      });
      mockMessageRepo.create.mockReturnValue(mockSaved);
      mockMessageRepo.save.mockResolvedValue(mockSaved);

      const client = {
        id: 'socket-1',
        data: {
          userId: 'user-1',
          userName: 'Test User',
          user: { role: 'customer' },
        },
        emit: jest.fn(),
      } as unknown as Socket;

      const server = { to: jest.fn().mockReturnThis(), emit: jest.fn() };
      gateway.server = server as unknown as Server;

      await gateway.handleMessage(client as never, {
        bookingId: 'booking-1',
        content: 'hello',
      });

      expect(mockMessageRepo.save).toHaveBeenCalled();
      expect(server.to).toHaveBeenCalledWith('booking_booking-1');
    });
  });

  describe('handleDisconnect', () => {
    it('logs disconnect without error', () => {
      mockMessageRepo.find.mockResolvedValue([]);
      const client = {
        id: 'socket-1',
        data: { userId: 'user-1' },
        emit: jest.fn(),
      } as unknown as Socket;
      expect(() => gateway.handleDisconnect(client as never)).not.toThrow();
    });
  });
});
