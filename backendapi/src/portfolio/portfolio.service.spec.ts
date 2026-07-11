import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { PortfolioService } from './portfolio.service';
import { PortfolioItem } from './entities/portfolio-item.entity';
import { Provider } from '../users/entities/provider.entity';
import { ServiceCategory } from '../services/entities/service-category.entity';
import { UserRole } from '../common/enums/user-role.enum';

type MockRepo = {
  find: jest.Mock;
  findOne: jest.Mock;
  create: jest.Mock;
  save: jest.Mock;
  remove: jest.Mock;
  count: jest.Mock;
};

function makeRepoMock(): MockRepo {
  return {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn(),
    create: jest.fn((x) => x),
    save: jest.fn((x) => Promise.resolve(x)),
    remove: jest.fn().mockResolvedValue(undefined),
    count: jest.fn().mockResolvedValue(0),
  };
}

describe('PortfolioService', () => {
  let service: PortfolioService;
  let portfolioRepo: MockRepo;
  let providerRepo: MockRepo;
  let categoryRepo: MockRepo;

  beforeEach(async () => {
    portfolioRepo = makeRepoMock();
    providerRepo = makeRepoMock();
    categoryRepo = makeRepoMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PortfolioService,
        { provide: getRepositoryToken(PortfolioItem), useValue: portfolioRepo },
        { provide: getRepositoryToken(Provider), useValue: providerRepo },
        { provide: getRepositoryToken(ServiceCategory), useValue: categoryRepo },
      ],
    }).compile();

    service = module.get<PortfolioService>(PortfolioService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('addItem', () => {
    it('should throw NotFoundException when provider not found', async () => {
      providerRepo.findOne.mockResolvedValue(null);

      await expect(
        service.addItem('u1', 'Title', 'http://img.jpg'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should create portfolio item with correct display order', async () => {
      providerRepo.findOne.mockResolvedValue({ id: 'p1' });
      portfolioRepo.count.mockResolvedValue(3);

      await service.addItem('u1', 'Title', 'http://img.jpg', 'Desc', 'cat1');

      expect(portfolioRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Title',
          displayOrder: 3,
        }),
      );
    });
  });

  describe('getProviderPortfolio', () => {
    it('should return items for a provider', async () => {
      portfolioRepo.find.mockResolvedValue([{ id: 'i1' }]);

      const result = await service.getProviderPortfolio('p1');
      expect(result).toHaveLength(1);
    });
  });

  describe('deleteItem', () => {
    it('should throw NotFoundException when item not found', async () => {
      portfolioRepo.findOne.mockResolvedValue(null);

      await expect(
        service.deleteItem('u1', 'i1', UserRole.PROVIDER),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException for non-owner non-admin', async () => {
      portfolioRepo.findOne.mockResolvedValue({
        provider: { user: { id: 'other-user' } },
      });

      await expect(
        service.deleteItem('u1', 'i1', UserRole.PROVIDER),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should delete item for owner', async () => {
      portfolioRepo.findOne.mockResolvedValue({
        provider: { user: { id: 'u1' } },
      });

      const result = await service.deleteItem('u1', 'i1', UserRole.PROVIDER);
      expect(result.message).toBe('Portfolio item deleted');
    });

    it('should delete item for admin', async () => {
      portfolioRepo.findOne.mockResolvedValue({
        provider: { user: { id: 'other-user' } },
      });

      const result = await service.deleteItem('admin', 'i1', UserRole.ADMIN);
      expect(result.message).toBe('Portfolio item deleted');
    });
  });
});
