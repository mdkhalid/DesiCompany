import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { Socket, Server } from 'socket.io';
import { ChatGateway } from './chat.gateway';
import { Message } from './entities/message.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { User } from '../users/entities/user.entity';

describe('ChatGateway', () => {
  let gateway: ChatGateway;

  const mockMessageRepo = {
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
  };

  const mockBookingRepo = {
    findOne: jest.fn(),
  };

  const mockUserRepo = {
    findOne: jest.fn(),
  };

  const mockJwtService = {
    verify: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatGateway,
        { provide: getRepositoryToken(Message), useValue: mockMessageRepo },
        { provide: getRepositoryToken(Booking), useValue: mockBookingRepo },
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    gateway = module.get(ChatGateway);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });

  describe('handleConnection', () => {
    it('rejects client with no token', () => {
      const client = {
        id: 'socket-1',
        handshake: { auth: {}, headers: {} },
        disconnect: jest.fn(),
        data: {},
      } as unknown as Socket;

      gateway.handleConnection(client as never);

      expect(client.disconnect).toHaveBeenCalled();
    });

    it('rejects client with invalid token', () => {
      mockJwtService.verify.mockImplementation(() => {
        throw new Error('invalid token');
      });

      const client = {
        id: 'socket-1',
        handshake: { auth: { token: 'bad-token' }, headers: {} },
        disconnect: jest.fn(),
        data: {},
      } as unknown as Socket;

      gateway.handleConnection(client as never);

      expect(client.disconnect).toHaveBeenCalled();
    });

    it('rejects client when user not found', async () => {
      mockJwtService.verify.mockReturnValue({
        sub: 'user-1',
        phone: '123',
        role: 'customer',
      });
      mockUserRepo.findOne.mockResolvedValue(null);

      const client = {
        id: 'socket-1',
        handshake: { auth: { token: 'valid-token' }, headers: {} },
        disconnect: jest.fn(),
        data: {},
      } as unknown as Socket;

      await gateway.handleConnection(client as never);

      expect(client.disconnect).toHaveBeenCalled();
    });

    it('accepts client with valid token and sets user data', async () => {
      const mockUser = { id: 'user-1', phone: '123', role: 'customer' };
      mockJwtService.verify.mockReturnValue({
        sub: 'user-1',
        phone: '123',
        role: 'customer',
      });
      mockUserRepo.findOne.mockResolvedValue(mockUser);

      const client = {
        id: 'socket-1',
        handshake: { auth: { token: 'valid-token' }, headers: {} },
        disconnect: jest.fn(),
        data: {},
      } as unknown as Socket;

      await gateway.handleConnection(client as never);

      expect(client.disconnect).not.toHaveBeenCalled();
      expect(client.data.userId).toBe('user-1');
      expect(client.data.user).toBe(mockUser);
    });

    it('extracts token from authorization header', async () => {
      const mockUser = { id: 'user-1', phone: '123', role: 'customer' };
      mockJwtService.verify.mockReturnValue({
        sub: 'user-1',
        phone: '123',
        role: 'customer',
      });
      mockUserRepo.findOne.mockResolvedValue(mockUser);

      const client = {
        id: 'socket-1',
        handshake: {
          auth: {},
          headers: { authorization: 'Bearer valid-token' },
        },
        disconnect: jest.fn(),
        data: {},
      } as unknown as Socket;

      await gateway.handleConnection(client as never);

      expect(mockJwtService.verify).toHaveBeenCalledWith('valid-token');
      expect(client.data.userId).toBe('user-1');
    });
  });

  describe('handleJoin', () => {
    it('rejects unauthenticated client', async () => {
      const client = {
        id: 'socket-1',
        data: {},
        emit: jest.fn(),
      } as unknown as Socket;

      await gateway.handleJoin(client as never, { bookingId: 'booking-1' });

      expect(client.emit).toHaveBeenCalledWith('error', {
        message: 'Unauthorized',
      });
    });

    it('rejects when booking not found', async () => {
      mockBookingRepo.findOne.mockResolvedValue(null);

      const client = {
        id: 'socket-1',
        data: { userId: 'user-1' },
        emit: jest.fn(),
      } as unknown as Socket;

      await gateway.handleJoin(client as never, { bookingId: 'booking-1' });

      expect(client.emit).toHaveBeenCalledWith('error', {
        message: 'Booking not found',
      });
    });

    it('rejects non-participant', async () => {
      mockBookingRepo.findOne.mockResolvedValue({
        id: 'booking-1',
        customer: { user: { id: 'user-2' } },
        provider: { user: { id: 'user-3' } },
      });

      const client = {
        id: 'socket-1',
        data: { userId: 'user-1' },
        emit: jest.fn(),
        join: jest.fn(),
      } as unknown as Socket;

      await gateway.handleJoin(client as never, { bookingId: 'booking-1' });

      expect(client.emit).toHaveBeenCalledWith('error', {
        message: 'Not a participant of this booking',
      });
    });

    it('allows participant to join and returns history', async () => {
      const mockMessages = [{ id: 'msg-1', content: 'hello' }];
      mockBookingRepo.findOne.mockResolvedValue({
        id: 'booking-1',
        customer: { user: { id: 'user-1' } },
        provider: { user: { id: 'user-2' } },
      });
      mockMessageRepo.find.mockResolvedValue(mockMessages);

      const client = {
        id: 'socket-1',
        data: { userId: 'user-1' },
        emit: jest.fn(),
        join: jest.fn(),
      } as unknown as Socket;

      await gateway.handleJoin(client as never, { bookingId: 'booking-1' });

      expect(client.join).toHaveBeenCalledWith('booking_booking-1');
      expect(client.emit).toHaveBeenCalledWith('history', mockMessages);
    });
  });

  describe('handleMessage', () => {
    it('rejects unauthenticated client', async () => {
      const client = {
        id: 'socket-1',
        data: {},
        emit: jest.fn(),
      } as unknown as Socket;

      await gateway.handleMessage(client as never, {
        bookingId: 'booking-1',
        content: 'hi',
      });

      expect(client.emit).toHaveBeenCalledWith('error', {
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
        data: { userId: 'user-1' },
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
      const client = {
        id: 'socket-1',
        data: { userId: 'user-1' },
      } as unknown as Socket;
      expect(() => gateway.handleDisconnect(client as never)).not.toThrow();
    });
  });
});
