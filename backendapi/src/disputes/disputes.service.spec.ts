import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { DisputesService } from './disputes.service';
import { Dispute, DisputeStatus } from './entities/dispute.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { User } from '../users/entities/user.entity';

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

describe('DisputesService', () => {
  let service: DisputesService;
  let disputeRepo: MockRepo;
  let bookingRepo: MockRepo;
  let userRepo: MockRepo;

  beforeEach(async () => {
    disputeRepo = makeRepoMock();
    bookingRepo = makeRepoMock();
    userRepo = makeRepoMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DisputesService,
        { provide: getRepositoryToken(Dispute), useValue: disputeRepo },
        { provide: getRepositoryToken(Booking), useValue: bookingRepo },
        { provide: getRepositoryToken(User), useValue: userRepo },
      ],
    }).compile();

    service = module.get<DisputesService>(DisputesService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('create', () => {
    it('should throw NotFoundException when booking not found', async () => {
      bookingRepo.findOne.mockResolvedValue(null);

      await expect(
        service.create({ bookingId: 'b1', reason: 'Bad service' }, 'u1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when user not involved in booking', async () => {
      bookingRepo.findOne.mockResolvedValue({
        customer: { user: { id: 'cu1' } },
        provider: { user: { id: 'pu1' } },
      });

      await expect(
        service.create({ bookingId: 'b1', reason: 'Bad service' }, 'u3'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException when open dispute already exists', async () => {
      bookingRepo.findOne.mockResolvedValue({
        customer: { user: { id: 'cu1' } },
        provider: { user: { id: 'pu1' } },
      });
      disputeRepo.findOne.mockResolvedValue({ id: 'existing' });

      await expect(
        service.create({ bookingId: 'b1', reason: 'Bad service' }, 'cu1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create dispute when customer raises it', async () => {
      bookingRepo.findOne.mockResolvedValue({
        customer: { user: { id: 'cu1' } },
        provider: { user: { id: 'pu1' } },
      });
      disputeRepo.findOne.mockResolvedValue(null);
      userRepo.findOne.mockResolvedValue({ id: 'cu1' });

      await service.create({ bookingId: 'b1', reason: 'Bad service' }, 'cu1');

      expect(disputeRepo.create).toHaveBeenCalled();
      expect(disputeRepo.save).toHaveBeenCalled();
    });

    it('should create dispute when provider raises it', async () => {
      bookingRepo.findOne.mockResolvedValue({
        customer: { user: { id: 'cu1' } },
        provider: { user: { id: 'pu1' } },
      });
      disputeRepo.findOne.mockResolvedValue(null);
      userRepo.findOne.mockResolvedValue({ id: 'pu1' });

      await service.create({ bookingId: 'b1', reason: 'Customer rude' }, 'pu1');

      expect(disputeRepo.save).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should throw NotFoundException when dispute not found', async () => {
      disputeRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne('d1')).rejects.toThrow(NotFoundException);
    });

    it('should return dispute when found', async () => {
      disputeRepo.findOne.mockResolvedValue({ id: 'd1' });

      const result = await service.findOne('d1');
      expect(result.id).toBe('d1');
    });
  });

  describe('resolve', () => {
    it('should throw NotFoundException when dispute not found', async () => {
      disputeRepo.findOne.mockResolvedValue(null);

      await expect(
        service.resolve('d1', { status: DisputeStatus.RESOLVED, resolution: 'Refund issued' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for already closed dispute', async () => {
      disputeRepo.findOne.mockResolvedValue({ status: DisputeStatus.RESOLVED });

      await expect(
        service.resolve('d1', { status: DisputeStatus.RESOLVED, resolution: 'Done' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should resolve dispute successfully', async () => {
      const dispute = { id: 'd1', status: DisputeStatus.OPEN };
      disputeRepo.findOne.mockResolvedValue(dispute);

      await service.resolve('d1', { status: DisputeStatus.RESOLVED, resolution: 'Refund' });

      expect(dispute.status).toBe(DisputeStatus.RESOLVED);
      expect(dispute.resolvedAt).toBeDefined();
      expect(disputeRepo.save).toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return all disputes', async () => {
      disputeRepo.find.mockResolvedValue([{ id: 'd1' }]);

      const result = await service.findAll();
      expect(result).toHaveLength(1);
    });
  });
});
