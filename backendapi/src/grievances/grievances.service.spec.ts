import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { GrievancesService } from './grievances.service';
import { Grievance, GrievanceStatus } from './entities/grievance.entity';
import { GrievanceMessage, MessageSender } from './entities/grievance-message.entity';

type MockRepo = {
  find: jest.Mock;
  findOne: jest.Mock;
  create: jest.Mock;
  save: jest.Mock;
  count: jest.Mock;
};

function makeRepoMock(): MockRepo {
  return {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn(),
    create: jest.fn((x) => x),
    save: jest.fn((x) => Promise.resolve(x)),
    count: jest.fn().mockResolvedValue(0),
  };
}

describe('GrievancesService', () => {
  let service: GrievancesService;
  let grievanceRepo: MockRepo;
  let messageRepo: MockRepo;

  beforeEach(async () => {
    grievanceRepo = makeRepoMock();
    messageRepo = makeRepoMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GrievancesService,
        { provide: getRepositoryToken(Grievance), useValue: grievanceRepo },
        { provide: getRepositoryToken(GrievanceMessage), useValue: messageRepo },
      ],
    }).compile();
    service = module.get<GrievancesService>(GrievancesService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('getGrievanceById', () => {
    it('should throw NotFoundException when not found', async () => {
      grievanceRepo.findOne.mockResolvedValue(null);
      await expect(service.getGrievanceById('g1')).rejects.toThrow(/Grievance not found/);
    });
  });

  describe('getAllGrievances', () => {
    it('should return all grievances', async () => {
      grievanceRepo.find.mockResolvedValue([{ id: 'g1' }]);
      const result = await service.getAllGrievances();
      expect(result).toHaveLength(1);
    });
  });

  describe('getDashboardStats', () => {
    it('should return stats', async () => {
      grievanceRepo.count.mockResolvedValue(10);
      grievanceRepo.find.mockResolvedValue([]);
      const result = await service.getDashboardStats();
      expect(result.total).toBe(10);
      expect(result).toHaveProperty('open');
      expect(result).toHaveProperty('escalated');
      expect(result).toHaveProperty('resolved');
    });
  });
});
