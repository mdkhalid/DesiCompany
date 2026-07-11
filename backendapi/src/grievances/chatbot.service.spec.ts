import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ChatbotService, BotResponse } from './chatbot.service';
import { Grievance, GrievanceCategory, GrievanceStatus } from './entities/grievance.entity';
import { GrievanceMessage, MessageSender } from './entities/grievance-message.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { User } from '../users/entities/user.entity';
import { BookingStatus } from '../common/enums/booking-status.enum';

type MockRepo = {
  find: jest.Mock;
  findOne: jest.Mock;
  create: jest.Mock;
  save: jest.Mock;
};

function makeRepoMock(): MockRepo {
  return {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn(),
    create: jest.fn((x) => x),
    save: jest.fn((x) => Promise.resolve(x)),
  };
}

describe('ChatbotService', () => {
  let service: ChatbotService;
  let grievanceRepo: MockRepo;
  let messageRepo: MockRepo;
  let bookingRepo: MockRepo;

  beforeEach(async () => {
    grievanceRepo = makeRepoMock();
    messageRepo = makeRepoMock();
    bookingRepo = makeRepoMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatbotService,
        { provide: getRepositoryToken(Grievance), useValue: grievanceRepo },
        { provide: getRepositoryToken(GrievanceMessage), useValue: messageRepo },
        { provide: getRepositoryToken(Booking), useValue: bookingRepo },
        { provide: getRepositoryToken(User), useValue: makeRepoMock() },
      ],
    }).compile();
    service = module.get<ChatbotService>(ChatbotService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('startGrievance', () => {
    it('should throw NotFoundException when booking not found', async () => {
      bookingRepo.findOne.mockResolvedValue(null);
      await expect(service.startGrievance('b1', 'c1')).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for wrong customer', async () => {
      bookingRepo.findOne.mockResolvedValue({ id: 'b1', customer: { id: 'other' } });
      await expect(service.startGrievance('b1', 'c1')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for non-completed booking', async () => {
      bookingRepo.findOne.mockResolvedValue({
        id: 'b1', customer: { id: 'c1' }, status: BookingStatus.REQUESTED,
      });
      await expect(service.startGrievance('b1', 'c1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('getCategories', () => {
    it('should return category list', () => {
      const cats = service.getCategories();
      expect(cats.length).toBeGreaterThan(0);
      expect(cats[0]).toHaveProperty('value');
      expect(cats[0]).toHaveProperty('label');
    });
  });

  describe('getGrievanceByBooking', () => {
    it('should return null when no grievance exists', async () => {
      grievanceRepo.findOne.mockResolvedValue(null);
      const result = await service.getGrievanceByBooking('b1');
      expect(result).toBeNull();
    });
  });
});
