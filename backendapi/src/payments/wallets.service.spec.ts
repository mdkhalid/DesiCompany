import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { WalletsService } from './wallets.service';
import { Wallet } from './entities/wallet.entity';
import { Transaction } from './entities/transaction.entity';
import { User } from '../users/entities/user.entity';
import { PlatformFeesService } from '../platform-fees/platform-fees.service';
import { IdempotencyService } from '../common/idempotency.service';

describe('WalletsService', () => {
  let service: WalletsService;
  let walletRepo: jest.Mocked<Repository<Wallet>>;
  let txRepo: jest.Mocked<Repository<Transaction>>;
  let userRepo: jest.Mocked<Repository<User>>;
  let platformFeesService: jest.Mocked<PlatformFeesService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WalletsService,
        {
          provide: getRepositoryToken(Wallet),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Transaction),
          useValue: {
            findAndCount: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: PlatformFeesService,
          useValue: {
            calculateInstantPayoutFee: jest.fn(),
          },
        },
        {
          provide: IdempotencyService,
          useValue: {
            withLock: jest.fn(async (_: string, __: number, fn: any) => fn()),
          },
        },
      ],
    }).compile();

    service = module.get(WalletsService);
    walletRepo = module.get(getRepositoryToken(Wallet));
    txRepo = module.get(getRepositoryToken(Transaction));
    userRepo = module.get(getRepositoryToken(User));
    platformFeesService = module.get(PlatformFeesService);
  });

  describe('getWallet', () => {
    it('returns existing wallet', async () => {
      walletRepo.findOne.mockResolvedValue({
        id: 'wallet-1',
        balance: 500,
        user: { id: 'user-1' },
      } as Wallet);
      const result = await service.getWallet('user-1');
      expect(result.balance).toBe(500);
    });

    it('creates wallet if not found', async () => {
      walletRepo.findOne.mockResolvedValue(null);
      userRepo.findOne.mockResolvedValue({ id: 'user-1' } as User);
      walletRepo.create.mockReturnValue({
        id: 'wallet-new',
        balance: 0,
      } as Wallet);
      walletRepo.save.mockResolvedValue({
        id: 'wallet-new',
        balance: 0,
      } as Wallet);

      const result = await service.getWallet('user-1');
      expect(result.balance).toBe(0);
    });

    it('throws NotFoundException when user not found', async () => {
      walletRepo.findOne.mockResolvedValue(null);
      userRepo.findOne.mockResolvedValue(null);
      await expect(service.getWallet('unknown')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getTransactions', () => {
    it('returns empty when no wallet exists', async () => {
      walletRepo.findOne.mockResolvedValue(null);
      const result = await service.getTransactions('user-1');
      expect(result.transactions).toEqual([]);
    });

    it('returns paginated transactions', async () => {
      walletRepo.findOne.mockResolvedValue({ id: 'wallet-1' } as Wallet);
      txRepo.findAndCount.mockResolvedValue([
        [
          {
            id: 'tx-1',
            type: 'credit',
            amount: 100,
            balanceAfter: 100,
            source: 'booking_payout',
            createdAt: new Date(),
          } as Transaction,
        ],
        1,
      ]);

      const result = await service.getTransactions('user-1', 1, 10);
      expect(result.transactions).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });
});
