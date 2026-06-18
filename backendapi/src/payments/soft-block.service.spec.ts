import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SoftBlockService } from './soft-block.service';
import { Wallet } from './entities/wallet.entity';
import { Transaction } from './entities/transaction.entity';
import { Provider } from '../users/entities/provider.entity';

describe('SoftBlockService', () => {
  let service: SoftBlockService;
  let providerRepo: jest.Mocked<any>;

  beforeEach(async () => {
    const queryBuilder = {
      innerJoinAndSelect: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SoftBlockService,
        {
          provide: getRepositoryToken(Wallet),
          useValue: {
            createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
          },
        },
        {
          provide: getRepositoryToken(Transaction),
          useValue: {
            createQueryBuilder: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            andWhere: jest.fn().mockReturnThis(),
            getMany: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: getRepositoryToken(Provider),
          useValue: {
            update: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(SoftBlockService);
    providerRepo = module.get(getRepositoryToken(Provider));
  });

  describe('config', () => {
    it('returns default config', () => {
      const config = service.getConfig();
      expect(config.thresholdMultiplier).toBe(2);
      expect(config.lookbackDays).toBe(30);
    });

    it('updates config', () => {
      service.updateConfig({ thresholdMultiplier: 3 });
      expect(service.getConfig().thresholdMultiplier).toBe(3);
    });
  });

  describe('checkAndBlockProviders', () => {
    it('blocks no one when no wallets exist', async () => {
      const walletQueryBuilder = await (
        service as any
      ).walletRepository.createQueryBuilder();
      walletQueryBuilder.getMany.mockResolvedValue([]);

      const result = await service.checkAndBlockProviders();
      expect(result.blocked).toBe(0);
    });
  });
});
