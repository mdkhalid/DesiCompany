import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { AdminService } from './admin.service';
import { User } from '../users/entities/user.entity';
import { Customer } from '../users/entities/customer.entity';
import { Provider } from '../users/entities/provider.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { Payment } from '../payments/entities/payment.entity';
import { Review } from '../reviews/entities/review.entity';
import { CommissionConfig } from '../commissions/entities/commission-config.entity';
import { UserStatus } from '../common/enums/user-status.enum';
import { UserRole } from '../common/enums/user-role.enum';
import { SoftBlockService } from '../payments/soft-block.service';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';

type MockRepo = {
  find: jest.Mock;
  findOne: jest.Mock;
  create: jest.Mock;
  save: jest.Mock;
  remove: jest.Mock;
  count: jest.Mock;
  update: jest.Mock;
  createQueryBuilder: jest.Mock;
};

function makeRepoMock(): MockRepo {
  const qb: any = {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue([]),
    getCount: jest.fn().mockResolvedValue(0),
  };
  return {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn(),
    create: jest.fn((x) => x),
    save: jest.fn((x) => Promise.resolve(x)),
    remove: jest.fn().mockResolvedValue(undefined),
    count: jest.fn().mockResolvedValue(0),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    createQueryBuilder: jest.fn().mockReturnValue(qb),
  };
}

describe('AdminService', () => {
  let service: AdminService;
  let userRepo: MockRepo;
  let providerRepo: MockRepo;
  let softBlockService: { unblockProvider: jest.Mock };
  let activityLogs: { log: jest.Mock };

  beforeEach(async () => {
    userRepo = makeRepoMock();
    providerRepo = makeRepoMock();
    softBlockService = { unblockProvider: jest.fn().mockResolvedValue(undefined) };
    activityLogs = { log: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: getRepositoryToken(Customer), useValue: makeRepoMock() },
        { provide: getRepositoryToken(Provider), useValue: providerRepo },
        { provide: getRepositoryToken(Booking), useValue: makeRepoMock() },
        { provide: getRepositoryToken(Payment), useValue: makeRepoMock() },
        { provide: getRepositoryToken(Review), useValue: makeRepoMock() },
        { provide: getRepositoryToken(CommissionConfig), useValue: makeRepoMock() },
        { provide: SoftBlockService, useValue: softBlockService },
        { provide: ActivityLogsService, useValue: activityLogs },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('getDashboard', () => {
    it('should return dashboard counts', async () => {
      const result = await service.getDashboard();
      expect(result).toHaveProperty('totalUsers');
      expect(result).toHaveProperty('totalBookings');
    });
  });

  describe('suspendUser', () => {
    it('should throw NotFoundException when user not found', async () => {
      userRepo.findOne.mockResolvedValue(null);

      await expect(
        service.suspendUser('u1', { reason: 'Bad' }, 'admin1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for admin user', async () => {
      userRepo.findOne.mockResolvedValue({ id: 'u1', role: UserRole.ADMIN });

      await expect(
        service.suspendUser('u1', { reason: 'Bad' }, 'admin1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should suspend a customer', async () => {
      userRepo.findOne.mockResolvedValue({
        id: 'u1',
        role: UserRole.CUSTOMER,
        status: UserStatus.ACTIVE,
      });

      await service.suspendUser('u1', { reason: 'Bad behavior' }, 'admin1');

      expect(userRepo.save).toHaveBeenCalled();
      expect(activityLogs.log).toHaveBeenCalled();
    });
  });

  describe('activateUser', () => {
    it('should throw NotFoundException when user not found', async () => {
      userRepo.findOne.mockResolvedValue(null);

      await expect(service.activateUser('u1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException when already active', async () => {
      userRepo.findOne.mockResolvedValue({
        id: 'u1',
        status: UserStatus.ACTIVE,
      });

      await expect(service.activateUser('u1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('deleteUser', () => {
    it('should throw NotFoundException when user not found', async () => {
      userRepo.findOne.mockResolvedValue(null);

      await expect(service.deleteUser('u1', 'admin1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException for admin', async () => {
      userRepo.findOne.mockResolvedValue({ id: 'u1', role: UserRole.ADMIN });

      await expect(service.deleteUser('u1', 'admin1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for self-delete', async () => {
      userRepo.findOne.mockResolvedValue({ id: 'u1', role: UserRole.CUSTOMER });

      await expect(service.deleteUser('u1', 'u1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('batchUpdateStatus', () => {
    it('should throw BadRequestException for invalid status', async () => {
      await expect(
        service.batchUpdateStatus(['u1'], 'deleted'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should update users successfully', async () => {
      const result = await service.batchUpdateStatus(
        ['u1', 'u2'],
        UserStatus.SUSPENDED,
      );
      expect(result.updated).toBe(2);
    });
  });
});
