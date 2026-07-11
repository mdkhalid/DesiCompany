import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ActivityLogsService } from './activity-logs.service';
import { ActivityLog } from './entities/activity-log.entity';

type MockRepo = {
  find: jest.Mock;
  findOne: jest.Mock;
  create: jest.Mock;
  save: jest.Mock;
  findAndCount: jest.Mock;
};

function makeRepoMock(): MockRepo {
  return {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn(),
    create: jest.fn((x) => x),
    save: jest.fn((x) => Promise.resolve(x)),
    findAndCount: jest.fn().mockResolvedValue([[], 0]),
  };
}

describe('ActivityLogsService', () => {
  let service: ActivityLogsService;
  let repo: MockRepo;

  beforeEach(async () => {
    repo = makeRepoMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ActivityLogsService,
        { provide: getRepositoryToken(ActivityLog), useValue: repo },
      ],
    }).compile();

    service = module.get<ActivityLogsService>(ActivityLogsService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('log', () => {
    it('should create and save log entry', async () => {
      await service.log('user.created', 'User', 'u1', 'admin1', { foo: 'bar' });

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'user.created',
          entityType: 'User',
          entityId: 'u1',
        }),
      );
      expect(repo.save).toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return paginated logs', async () => {
      repo.findAndCount.mockResolvedValue([[{ id: 'log1' }], 1]);

      const result = await service.findAll(1, 50);
      expect(result.logs).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.totalPages).toBe(1);
    });
  });

  describe('findByEntity', () => {
    it('should return logs for a specific entity', async () => {
      repo.find.mockResolvedValue([{ id: 'log1', entityType: 'User' }]);

      const result = await service.findByEntity('User', 'u1');
      expect(result).toHaveLength(1);
    });
  });
});
