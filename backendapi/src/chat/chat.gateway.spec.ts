import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ChatGateway } from './chat.gateway';
import { Message } from './entities/message.entity';
import { Booking } from '../bookings/entities/booking.entity';

describe('ChatGateway', () => {
  let gateway: ChatGateway;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatGateway,
        {
          provide: getRepositoryToken(Message),
          useValue: {
            find: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Booking),
          useValue: {},
        },
      ],
    }).compile();

    gateway = module.get(ChatGateway);
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });

  describe('handleConnection / handleDisconnect', () => {
    it('logs connect and disconnect without error', () => {
      const client = { id: 'socket-1' } as any;
      expect(() => gateway.handleConnection(client)).not.toThrow();
      expect(() => gateway.handleDisconnect(client)).not.toThrow();
    });
  });
});
