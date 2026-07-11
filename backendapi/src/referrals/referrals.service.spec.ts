import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { ReferralsService } from './referrals.service';
import { Referral } from './entities/referral.entity';
import { User } from '../users/entities/user.entity';
import { Wallet } from '../payments/entities/wallet.entity';
import { Transaction } from '../payments/entities/transaction.entity';

type MockRepo = {
  find: jest.Mock;
  findOne: jest.Mock;
  create: jest.Mock;
  save: jest.Mock;
  count: jest.Mock;
  createQueryBuilder: jest.Mock;
};

function makeRepoMock(): MockRepo {
  return {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn(),
    create: jest.fn((x) => x),
    save: jest.fn((x) => Promise.resolve(x)),
    count: jest.fn().mockResolvedValue(0),
    createQueryBuilder: jest.fn(() => ({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ total: '0' }),
    })),
  };
}

describe('ReferralsService', () => {
  let service: ReferralsService;
  let referralRepo: MockRepo;
  let userRepo: MockRepo;
  let walletRepo: MockRepo;
  let transactionRepo: MockRepo;

  beforeEach(async () => {
    referralRepo = makeRepoMock();
    userRepo = makeRepoMock();
    walletRepo = makeRepoMock();
    transactionRepo = makeRepoMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReferralsService,
        { provide: getRepositoryToken(Referral), useValue: referralRepo },
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: getRepositoryToken(Wallet), useValue: walletRepo },
        { provide: getRepositoryToken(Transaction), useValue: transactionRepo },
      ],
    }).compile();

    service = module.get<ReferralsService>(ReferralsService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('getOrCreateReferralCode', () => {
    it('should throw NotFoundException when user not found', async () => {
      userRepo.findOne.mockResolvedValue(null);

      await expect(service.getOrCreateReferralCode('u1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should create new referral if none exists', async () => {
      userRepo.findOne.mockResolvedValue({ id: 'u1' });
      referralRepo.findOne.mockResolvedValue(null);

      const result = await service.getOrCreateReferralCode('u1');

      expect(result.referralCode).toBeDefined();
      expect(result.referralCode).toHaveLength(8);
      expect(referralRepo.create).toHaveBeenCalled();
    });

    it('should return existing referral code', async () => {
      userRepo.findOne.mockResolvedValue({ id: 'u1' });
      referralRepo.findOne.mockResolvedValue({
        referralCode: 'EXISTING1',
        referrerCreditAmount: 50,
        referredCreditAmount: 50,
      });

      const result = await service.getOrCreateReferralCode('u1');

      expect(result.referralCode).toBe('EXISTING1');
    });
  });

  describe('applyReferralCode', () => {
    it('should throw NotFoundException for invalid code', async () => {
      userRepo.findOne.mockResolvedValue({ id: 'u2' });
      referralRepo.findOne.mockResolvedValue(null);

      await expect(
        service.applyReferralCode('u2', 'INVALID'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for self-referral', async () => {
      userRepo.findOne.mockResolvedValue({ id: 'u1' });
      referralRepo.findOne.mockResolvedValue({
        referrer: { id: 'u1' },
        referralCode: 'CODE1',
      });

      await expect(
        service.applyReferralCode('u1', 'CODE1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ConflictException for used code', async () => {
      userRepo.findOne.mockResolvedValue({ id: 'u2' });
      referralRepo.findOne.mockResolvedValue({
        referrer: { id: 'u1' },
        referralCode: 'CODE1',
        isUsed: true,
      });

      await expect(
        service.applyReferralCode('u2', 'CODE1'),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('getReferralStats', () => {
    it('should return zero stats when no referral exists', async () => {
      referralRepo.findOne.mockResolvedValue(null);

      const result = await service.getReferralStats('u1');
      expect(result.referralCode).toBeNull();
      expect(result.totalReferrals).toBe(0);
    });
  });
});
