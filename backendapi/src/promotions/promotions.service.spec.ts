import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { PromotionsService } from './promotions.service';
import { PromotedListing, PromotedListingStatus } from './entities/promoted-listing.entity';
import { Provider } from '../users/entities/provider.entity';
import { ServiceCategory } from '../services/entities/service-category.entity';
import { Wallet } from '../payments/entities/wallet.entity';
import { Transaction } from '../payments/entities/transaction.entity';

type MockRepo = {
  find: jest.Mock;
  findOne: jest.Mock;
  create: jest.Mock;
  save: jest.Mock;
  increment: jest.Mock;
  createQueryBuilder: jest.Mock;
};

function makeRepoMock(): MockRepo {
  const qb: any = {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue([]),
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue(undefined),
  };
  return {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn(),
    create: jest.fn((x) => x),
    save: jest.fn((x) => Promise.resolve(x)),
    increment: jest.fn().mockResolvedValue(undefined),
    createQueryBuilder: jest.fn().mockReturnValue(qb),
  };
}

describe('PromotionsService', () => {
  let service: PromotionsService;
  let promotedRepo: MockRepo;
  let providerRepo: MockRepo;
  let categoryRepo: MockRepo;
  let walletRepo: MockRepo;
  let transactionRepo: MockRepo;

  beforeEach(async () => {
    promotedRepo = makeRepoMock();
    providerRepo = makeRepoMock();
    categoryRepo = makeRepoMock();
    walletRepo = makeRepoMock();
    transactionRepo = makeRepoMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PromotionsService,
        { provide: getRepositoryToken(PromotedListing), useValue: promotedRepo },
        { provide: getRepositoryToken(Provider), useValue: providerRepo },
        { provide: getRepositoryToken(ServiceCategory), useValue: categoryRepo },
        { provide: getRepositoryToken(Wallet), useValue: walletRepo },
        { provide: getRepositoryToken(Transaction), useValue: transactionRepo },
      ],
    }).compile();

    service = module.get<PromotionsService>(PromotionsService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('createPromotion', () => {
    it('should throw NotFoundException when provider not found', async () => {
      providerRepo.findOne.mockResolvedValue(null);
      await expect(
        service.createPromotion('u1', null, 100, 7),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when bid amount < 50', async () => {
      providerRepo.findOne.mockResolvedValue({ id: 'p1' });
      await expect(
        service.createPromotion('u1', null, 30, 7),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when wallet insufficient', async () => {
      providerRepo.findOne.mockResolvedValue({ id: 'p1' });
      walletRepo.findOne.mockResolvedValue({ balance: 100 });
      await expect(
        service.createPromotion('u1', null, 100, 7),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create promotion successfully', async () => {
      providerRepo.findOne.mockResolvedValue({ id: 'p1' });
      categoryRepo.findOne.mockResolvedValue(null);
      walletRepo.findOne.mockResolvedValue({ balance: 1000, user: { id: 'u1' } });
      walletRepo.save.mockImplementation((w) => Promise.resolve(w));
      transactionRepo.save.mockImplementation((t) => Promise.resolve(t));
      promotedRepo.save.mockImplementation((p) => Promise.resolve({ ...p, id: 'promo-1' }));

      const result = await service.createPromotion('u1', null, 100, 7);

      expect(walletRepo.save).toHaveBeenCalled();
      expect(transactionRepo.create).toHaveBeenCalled();
      expect(promotedRepo.create).toHaveBeenCalled();
      expect(promotedRepo.save).toHaveBeenCalled();
      expect(result.id).toBe('promo-1');
    });

    it('should set correct status to ACTIVE', async () => {
      providerRepo.findOne.mockResolvedValue({ id: 'p1' });
      categoryRepo.findOne.mockResolvedValue(null);
      walletRepo.findOne.mockResolvedValue({ balance: 1000, user: { id: 'u1' } });
      walletRepo.save.mockImplementation((w) => Promise.resolve(w));
      transactionRepo.save.mockImplementation((t) => Promise.resolve(t));
      promotedRepo.save.mockImplementation((p) => Promise.resolve(p));

      const created = {};
      promotedRepo.create.mockReturnValue(created);

      await service.createPromotion('u1', null, 100, 7);

      expect(promotedRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ status: PromotedListingStatus.ACTIVE }),
      );
    });
  });

  describe('getActivePromotions', () => {
    it('should call query builder and return results', async () => {
      const mockPromo = { id: 'promo-1', status: 'active' };
      const qb = promotedRepo.createQueryBuilder();
      qb.getMany.mockResolvedValue([mockPromo]);

      const result = await service.getActivePromotions();
      expect(result).toEqual([mockPromo]);
    });

    it('should filter by categoryId when provided', async () => {
      const qb = promotedRepo.createQueryBuilder();
      qb.getMany.mockResolvedValue([]);

      await service.getActivePromotions('cat-1');
      expect(qb.andWhere).toHaveBeenCalledWith(
        'promotion.category_id = :categoryId',
        { categoryId: 'cat-1' },
      );
    });
  });

  describe('getProviderPromotions', () => {
    it('should return promotions for a provider', async () => {
      promotedRepo.find.mockResolvedValue([{ id: 'promo-1' }]);
      const result = await service.getProviderPromotions('prov-1');
      expect(result).toHaveLength(1);
      expect(promotedRepo.find).toHaveBeenCalledWith({
        where: { provider: { id: 'prov-1' } },
        order: { createdAt: 'DESC' },
      });
    });
  });

  describe('recordClick', () => {
    it('should increment clicks', async () => {
      await service.recordClick('promo-1');
      expect(promotedRepo.increment).toHaveBeenCalledWith({ id: 'promo-1' }, 'clicks', 1);
    });
  });

  describe('recordImpression', () => {
    it('should increment impressions', async () => {
      await service.recordImpression('promo-1');
      expect(promotedRepo.increment).toHaveBeenCalledWith({ id: 'promo-1' }, 'impressions', 1);
    });
  });

  describe('expireOldPromotions', () => {
    it('should execute the update query', async () => {
      await service.expireOldPromotions();
      const qb = promotedRepo.createQueryBuilder();
      expect(qb.update).toHaveBeenCalled();
      expect(qb.set).toHaveBeenCalledWith({ status: PromotedListingStatus.EXPIRED });
      expect(qb.execute).toHaveBeenCalled();
    });
  });
});
