import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { PackagesService } from './packages.service';
import { ServicePackage } from './entities/service-package.entity';
import { Provider } from '../users/entities/provider.entity';
import { ProviderService } from '../services/entities/provider-service.entity';

type MockRepo = {
  find: jest.Mock;
  findOne: jest.Mock;
  create: jest.Mock;
  save: jest.Mock;
  createQueryBuilder: jest.Mock;
};

function makeRepoMock(): MockRepo {
  const qb: any = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue([]),
  };
  return {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn(),
    create: jest.fn((x) => x),
    save: jest.fn((x) => Promise.resolve(x)),
    createQueryBuilder: jest.fn().mockReturnValue(qb),
  };
}

describe('PackagesService', () => {
  let service: PackagesService;
  let packageRepo: MockRepo;
  let providerRepo: MockRepo;
  let providerServiceRepo: MockRepo;

  beforeEach(async () => {
    packageRepo = makeRepoMock();
    providerRepo = makeRepoMock();
    providerServiceRepo = makeRepoMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PackagesService,
        { provide: getRepositoryToken(ServicePackage), useValue: packageRepo },
        { provide: getRepositoryToken(Provider), useValue: providerRepo },
        { provide: getRepositoryToken(ProviderService), useValue: providerServiceRepo },
      ],
    }).compile();

    service = module.get<PackagesService>(PackagesService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('createPackage', () => {
    it('should throw BadRequestException when fewer than 2 services', async () => {
      await expect(
        service.createPackage('u1', 'PKG', 'desc', ['s1'], 500),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when provider not found', async () => {
      providerRepo.findOne.mockResolvedValue(null);
      await expect(
        service.createPackage('u1', 'PKG', 'desc', ['s1', 's2'], 500),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when services not all owned by provider', async () => {
      providerRepo.findOne.mockResolvedValue({ id: 'prov-1' });
      providerServiceRepo.createQueryBuilder().getMany.mockResolvedValue([
        { id: 's1', fixedRate: 100 },
      ]);

      await expect(
        service.createPackage('u1', 'PKG', 'desc', ['s1', 's2'], 500),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create package with correct discount', async () => {
      providerRepo.findOne.mockResolvedValue({ id: 'prov-1' });
      providerServiceRepo.createQueryBuilder().getMany.mockResolvedValue([
        { id: 's1', fixedRate: 200, hourlyRate: null, dailyRate: null },
        { id: 's2', fixedRate: 300, hourlyRate: null, dailyRate: null },
      ]);
      packageRepo.save.mockImplementation((p) => Promise.resolve({ ...p, id: 'pkg-1' }));

      const result = await service.createPackage('u1', 'PKG', 'desc', ['s1', 's2'], 400);

      expect(packageRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'PKG',
          bundlePrice: 400,
          originalPrice: 500,
          discountPercent: 20,
          isActive: true,
        }),
      );
      expect(result.id).toBe('pkg-1');
    });

    it('should set discountPercent to 0 when bundle >= original', async () => {
      providerRepo.findOne.mockResolvedValue({ id: 'prov-1' });
      providerServiceRepo.createQueryBuilder().getMany.mockResolvedValue([
        { id: 's1', fixedRate: 100, hourlyRate: null, dailyRate: null },
        { id: 's2', fixedRate: 200, hourlyRate: null, dailyRate: null },
      ]);
      packageRepo.save.mockImplementation((p) => Promise.resolve(p));

      await service.createPackage('u1', 'PKG', 'desc', ['s1', 's2'], 400);

      expect(packageRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ discountPercent: 0 }),
      );
    });
  });

  describe('getProviderPackages', () => {
    it('should find packages for provider', async () => {
      packageRepo.find.mockResolvedValue([{ id: 'pkg-1' }]);
      const result = await service.getProviderPackages('prov-1');
      expect(result).toHaveLength(1);
      expect(packageRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { provider: { id: 'prov-1' }, isActive: true },
        }),
      );
    });
  });

  describe('getAllActivePackages', () => {
    it('should return all active packages', async () => {
      packageRepo.find.mockResolvedValue([{ id: 'pkg-1' }, { id: 'pkg-2' }]);
      const result = await service.getAllActivePackages();
      expect(result).toHaveLength(2);
    });
  });

  describe('getPackageById', () => {
    it('should throw NotFoundException when not found', async () => {
      packageRepo.findOne.mockResolvedValue(null);
      await expect(service.getPackageById('pkg-1')).rejects.toThrow(NotFoundException);
    });

    it('should return package when found', async () => {
      packageRepo.findOne.mockResolvedValue({ id: 'pkg-1' });
      const result = await service.getPackageById('pkg-1');
      expect(result.id).toBe('pkg-1');
    });
  });

  describe('deactivatePackage', () => {
    it('should throw NotFoundException when not found', async () => {
      packageRepo.findOne.mockResolvedValue(null);
      await expect(service.deactivatePackage('u1', 'pkg-1')).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when user not owner', async () => {
      packageRepo.findOne.mockResolvedValue({
        id: 'pkg-1',
        provider: { user: { id: 'u-other' } },
      });
      await expect(service.deactivatePackage('u1', 'pkg-1')).rejects.toThrow(BadRequestException);
    });

    it('should deactivate when owner', async () => {
      const pkg = {
        id: 'pkg-1',
        isActive: true,
        provider: { user: { id: 'u1' } },
      };
      packageRepo.findOne.mockResolvedValue(pkg);
      packageRepo.save.mockImplementation((p) => Promise.resolve(p));

      await service.deactivatePackage('u1', 'pkg-1');

      expect(pkg.isActive).toBe(false);
      expect(packageRepo.save).toHaveBeenCalled();
    });
  });
});
