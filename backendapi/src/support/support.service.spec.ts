import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { SupportService } from './support.service';
import { SupportTicket, SupportTicketStatus, SupportTicketCategory } from './entities/support-ticket.entity';
import { SupportTicketMessage } from './entities/support-ticket-message.entity';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../common/enums/user-role.enum';

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

describe('SupportService', () => {
  let service: SupportService;
  let ticketRepo: MockRepo;
  let messageRepo: MockRepo;
  let userRepo: MockRepo;

  beforeEach(async () => {
    ticketRepo = makeRepoMock();
    messageRepo = makeRepoMock();
    userRepo = makeRepoMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SupportService,
        { provide: getRepositoryToken(SupportTicket), useValue: ticketRepo },
        { provide: getRepositoryToken(SupportTicketMessage), useValue: messageRepo },
        { provide: getRepositoryToken(User), useValue: userRepo },
      ],
    }).compile();
    service = module.get<SupportService>(SupportService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('createTicket', () => {
    it('should throw NotFoundException when user not found', async () => {
      userRepo.findOne.mockResolvedValue(null);
      await expect(
        service.createTicket('u1', 'Sub', 'Desc', SupportTicketCategory.GENERAL),
      ).rejects.toThrow(NotFoundException);
    });

    it('should create ticket successfully', async () => {
      userRepo.findOne.mockResolvedValue({ id: 'u1' });
      await service.createTicket('u1', 'Sub', 'Desc', SupportTicketCategory.GENERAL);
      expect(ticketRepo.save).toHaveBeenCalled();
    });
  });

  describe('getTicketById', () => {
    it('should throw NotFoundException when not found', async () => {
      ticketRepo.findOne.mockResolvedValue(null);
      await expect(service.getTicketById('t1')).rejects.toThrow(NotFoundException);
    });

    it('should return ticket', async () => {
      ticketRepo.findOne.mockResolvedValue({ id: 't1' });
      const result = await service.getTicketById('t1');
      expect(result.id).toBe('t1');
    });
  });

  describe('ensureAccess', () => {
    it('should allow admin access', async () => {
      ticketRepo.findOne.mockResolvedValue({ id: 't1', user: { id: 'other' } });
      const result = await service.ensureAccess('t1', 'admin1', UserRole.ADMIN);
      expect(result.id).toBe('t1');
    });

    it('should throw ForbiddenException for non-owner', async () => {
      ticketRepo.findOne.mockResolvedValue({ id: 't1', user: { id: 'owner' } });
      await expect(
        service.ensureAccess('t1', 'other', UserRole.CUSTOMER),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('addMessage', () => {
    it('should throw NotFoundException when sender not found', async () => {
      ticketRepo.findOne.mockResolvedValue({ id: 't1', user: { id: 'u1' } });
      userRepo.findOne.mockResolvedValue(null);
      await expect(
        service.addMessage('t1', 'u2', 'Hello', false),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
