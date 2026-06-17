import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { LedgerService } from './ledger.service';
import { Wallet } from './entities/wallet.entity';
import { Transaction } from './entities/transaction.entity';
import { Booking } from '../bookings/entities/booking.entity';

describe('LedgerService', () => {
  let service: LedgerService;

  const mockQueryBuilder = {
    innerJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    getMany: jest.fn(),
    getManyRaw: jest.fn(),
  };

  const mockTxQueryBuilder = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getMany: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LedgerService,
        {
          provide: getRepositoryToken(Wallet),
          useValue: {
            createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
          },
        },
        {
          provide: getRepositoryToken(Transaction),
          useValue: {
            createQueryBuilder: jest.fn().mockReturnValue(mockTxQueryBuilder),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Booking),
          useValue: {},
        },
        {
          provide: DataSource,
          useValue: {
            transaction: jest.fn(async (cb: any) => cb({
              save: jest.fn(),
              create: jest.fn(),
            })),
          },
        },
      ],
    }).compile();

    service = module.get(LedgerService);
  });

  describe('settleOutstandingCommissions', () => {
    it('settles zero wallets when none exist', async () => {
      mockQueryBuilder.getMany.mockResolvedValue([]);
      const result = await service.settleOutstandingCommissions();
      expect(result.settledWallets).toBe(0);
    });
  });
});
