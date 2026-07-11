import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ErrorLogsService } from './error-logs.service';
import { ErrorLog } from './entities/error-log.entity';

type MockRepo = {
  find: jest.Mock;
  findOne: jest.Mock;
  findOneBy: jest.Mock;
  save: jest.Mock;
  count: jest.Mock;
  delete: jest.Mock;
  findAndCount: jest.Mock;
  update: jest.Mock;
  createQueryBuilder: jest.Mock;
};

function makeRepoMock(): MockRepo {
  return {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn(),
    findOneBy: jest.fn(),
    save: jest.fn((x) => Promise.resolve(x)),
    count: jest.fn().mockResolvedValue(0),
    delete: jest.fn().mockResolvedValue({ affected: 5 }),
    findAndCount: jest.fn().mockResolvedValue([[], 0]),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    createQueryBuilder: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
    })),
  };
}

describe('ErrorLogsService', () => {
  let service: ErrorLogsService;
  let repo: MockRepo;

  beforeEach(async () => {
    repo = makeRepoMock();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ErrorLogsService,
        { provide: getRepositoryToken(ErrorLog), useValue: repo },
      ],
    }).compile();
    service = module.get<ErrorLogsService>(ErrorLogsService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('create', () => {
    it('should save error log', async () => {
      await service.create({ statusCode: 500, message: 'err' } as any);
      expect(repo.save).toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return paginated results', async () => {
      repo.findAndCount.mockResolvedValue([[{ id: 'e1' }], 1]);
      const result = await service.findAll(1, 50);
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  describe('findOne', () => {
    it('should return error log by id', async () => {
      repo.findOneBy.mockResolvedValue({ id: 'e1' });
      const result = await service.findOne('e1');
      expect(result.id).toBe('e1');
    });
  });

  describe('resolve', () => {
    it('should return null when not found', async () => {
      repo.update.mockResolvedValue({ affected: 0 });
      const result = await service.resolve('e1', 'admin');
      expect(result).toBeNull();
    });

    it('should resolve and return updated log', async () => {
      repo.update.mockResolvedValue({ affected: 1 });
      repo.findOneBy.mockResolvedValue({ id: 'e1' });
      const result = await service.resolve('e1', 'admin');
      expect(result.id).toBe('e1');
    });
  });

  describe('getStats', () => {
    it('should return error stats', async () => {
      repo.count.mockResolvedValue(10);
      const result = await service.getStats();
      expect(result.total).toBe(10);
    });
  });

  describe('purgeOlderThan', () => {
    it('should delete old logs and return count', async () => {
      const result = await service.purgeOlderThan(30);
      expect(result).toBe(5);
    });
  });
});
