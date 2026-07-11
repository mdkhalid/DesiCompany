import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import { LoyaltyService } from './loyalty.service';
import { LoyaltyPoint, LoyaltyTier } from './entities/loyalty-point.entity';
import { Wallet } from '../payments/entities/wallet.entity';
import { Transaction } from '../payments/entities/transaction.entity';
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

describe('LoyaltyService', () => {
  let service: LoyaltyService;
  let loyaltyRepo: MockRepo;
  let walletRepo: MockRepo;
  let transactionRepo: MockRepo;

  beforeEach(async () => {
    loyaltyRepo = makeRepoMock();
    walletRepo = makeRepoMock();
    transactionRepo = makeRepoMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LoyaltyService,
        { provide: getRepositoryToken(LoyaltyPoint), useValue: loyaltyRepo },
        { provide: getRepositoryToken(Wallet), useValue: walletRepo },
        { provide: getRepositoryToken(Transaction), useValue: transactionRepo },
        { provide: getRepositoryToken(User), useValue: makeRepoMock() },
      ],
    }).compile();

    service = module.get<LoyaltyService>(LoyaltyService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('getOrCreateLoyalty', () => {
    it('should create new loyalty record when none exists', async () => {
      loyaltyRepo.findOne.mockResolvedValue(null);

      const result = await service.getOrCreateLoyalty('u1');
      expect(result.points).toBe(0);
      expect(result.tier).toBe(LoyaltyTier.BRONZE);
      expect(loyaltyRepo.create).toHaveBeenCalled();
    });

    it('should return existing loyalty record', async () => {
      loyaltyRepo.findOne.mockResolvedValue({ id: 'l1', points: 100 });

      const result = await service.getOrCreateLoyalty('u1');
      expect(result.points).toBe(100);
    });
  });

  describe('awardPointsForBooking', () => {
    it('should award 10% of booking amount as points', async () => {
      loyaltyRepo.findOne.mockResolvedValue({
        points: 0,
        totalEarned: 0,
        totalRedeemed: 0,
        bookingsCount: 0,
        tier: LoyaltyTier.BRONZE,
      });

      const result = await service.awardPointsForBooking('u1', 1000, 'b1');

      expect(result.pointsEarned).toBe(100);
      expect(result.tier).toBe(LoyaltyTier.BRONZE);
    });

    it('should upgrade tier based on total earned', async () => {
      loyaltyRepo.findOne.mockResolvedValue({
        points: 4980,
        totalEarned: 4980,
        totalRedeemed: 0,
        bookingsCount: 49,
        tier: LoyaltyTier.SILVER,
      });

      const result = await service.awardPointsForBooking('u1', 200, 'b1');

      expect(result.pointsEarned).toBe(20);
      expect(result.tier).toBe(LoyaltyTier.GOLD);
    });

    it('should not double-award for the same booking (idempotent)', async () => {
      const loyaltyObj = {
        points: 0,
        totalEarned: 0,
        totalRedeemed: 0,
        bookingsCount: 0,
        tier: LoyaltyTier.BRONZE,
      };
      loyaltyRepo.findOne.mockResolvedValue(loyaltyObj);

      await service.awardPointsForBooking('u1', 1000, 'b1');
      await service.awardPointsForBooking('u1', 1000, 'b1');

      // Only the first call should persist an award.
      expect(loyaltyRepo.save).toHaveBeenCalledTimes(1);
    });
  });

  describe('redeemPoints', () => {
    it('should throw BadRequestException for non-positive points', async () => {
      loyaltyRepo.findOne.mockResolvedValue({ points: 200 });

      await expect(service.redeemPoints('u1', 0)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for insufficient points', async () => {
      loyaltyRepo.findOne.mockResolvedValue({ points: 50 });

      await expect(service.redeemPoints('u1', 100)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for below minimum redemption', async () => {
      loyaltyRepo.findOne.mockResolvedValue({ points: 200 });

      await expect(service.redeemPoints('u1', 50)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should redeem points and credit wallet', async () => {
      loyaltyRepo.findOne.mockResolvedValue({
        points: 500,
        totalRedeemed: 0,
      });
      walletRepo.findOne.mockResolvedValue(null);

      const result = await service.redeemPoints('u1', 200);

      expect(result.redeemed).toBe(200);
      expect(result.walletCredit).toBe(20);
      expect(result.remainingPoints).toBe(300);
    });
  });

  describe('getLeaderboard', () => {
    it('should return top users by points', async () => {
      loyaltyRepo.find.mockResolvedValue([{ points: 500 }, { points: 300 }]);

      const result = await service.getLeaderboard(5);
      expect(result).toHaveLength(2);
    });
  });
});
