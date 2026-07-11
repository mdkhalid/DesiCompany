import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { KycService } from './kyc.service';
import { KycDocument } from './entities/kyc-document.entity';
import { Provider } from '../users/entities/provider.entity';
import { User } from '../users/entities/user.entity';
import { KycStatus } from '../common/enums/kyc-status.enum';
import { UserStatus } from '../common/enums/user-status.enum';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';

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

describe('KycService', () => {
  let service: KycService;
  let kycRepo: MockRepo;
  let providerRepo: MockRepo;
  let userRepo: MockRepo;
  let activityLogs: { log: jest.Mock };

  beforeEach(async () => {
    kycRepo = makeRepoMock();
    providerRepo = makeRepoMock();
    userRepo = makeRepoMock();
    activityLogs = { log: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KycService,
        { provide: getRepositoryToken(KycDocument), useValue: kycRepo },
        { provide: getRepositoryToken(Provider), useValue: providerRepo },
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: ActivityLogsService, useValue: activityLogs },
      ],
    }).compile();

    service = module.get<KycService>(KycService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('uploadDocument', () => {
    it('should throw NotFoundException when provider not found', async () => {
      providerRepo.findOne.mockResolvedValue(null);

      await expect(
        service.uploadDocument('p1', 'aadhaar', 'http://doc.url'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should create and save KYC document', async () => {
      providerRepo.findOne.mockResolvedValue({ id: 'p1' });

      await service.uploadDocument('p1', 'aadhaar', 'http://doc.url');

      expect(kycRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          documentType: 'aadhaar',
          status: KycStatus.PENDING,
        }),
      );
      expect(kycRepo.save).toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return all KYC documents', async () => {
      kycRepo.find.mockResolvedValue([{ id: 'k1' }]);

      const result = await service.findAll();
      expect(result).toHaveLength(1);
    });
  });

  describe('findByProvider', () => {
    it('should return documents for a provider', async () => {
      kycRepo.find.mockResolvedValue([{ id: 'k1' }]);

      const result = await service.findByProvider('p1');
      expect(result).toHaveLength(1);
    });
  });

  describe('updateStatus', () => {
    it('should throw NotFoundException when document not found', async () => {
      kycRepo.findOne.mockResolvedValue(null);

      await expect(
        service.updateStatus('k1', KycStatus.APPROVED),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when rejecting without remarks', async () => {
      kycRepo.findOne.mockResolvedValue({ id: 'k1' });

      await expect(
        service.updateStatus('k1', KycStatus.REJECTED),
      ).rejects.toThrow(BadRequestException);
    });

    it('should approve KYC and mark provider verified', async () => {
      const doc = {
        id: 'k1',
        status: KycStatus.PENDING,
        provider: {
          id: 'p1',
          user: { status: UserStatus.ACTIVE },
        },
      };
      kycRepo.findOne.mockResolvedValue(doc);

      await service.updateStatus('k1', KycStatus.APPROVED);

      expect(doc.provider.isVerified).toBe(true);
      expect(providerRepo.save).toHaveBeenCalled();
      expect(activityLogs.log).toHaveBeenCalledWith(
        'kyc.approved',
        'KycDocument',
        'k1',
        undefined,
        { providerId: 'p1' },
      );
    });

    it('should not activate user if suspended', async () => {
      const doc = {
        id: 'k1',
        provider: {
          user: { status: UserStatus.SUSPENDED },
        },
      };
      kycRepo.findOne.mockResolvedValue(doc);

      await service.updateStatus('k1', KycStatus.APPROVED);

      expect(doc.provider.user.status).toBe(UserStatus.SUSPENDED);
      expect(userRepo.save).not.toHaveBeenCalled();
    });

    it('should reject KYC and mark provider rejected', async () => {
      const doc = {
        id: 'k1',
        provider: { id: 'p1' },
      };
      kycRepo.findOne.mockResolvedValue(doc);

      await service.updateStatus('k1', KycStatus.REJECTED, 'Invalid doc');

      expect(doc.provider.isVerified).toBe(false);
      expect(providerRepo.save).toHaveBeenCalled();
    });
  });
});
