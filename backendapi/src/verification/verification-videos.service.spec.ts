import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { VerificationVideosService } from './verification-videos.service';
import { VerificationVideo, VerificationVideoStatus } from './entities/verification-video.entity';
import { Provider } from '../users/entities/provider.entity';

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

describe('VerificationVideosService', () => {
  let service: VerificationVideosService;
  let videoRepo: MockRepo;
  let providerRepo: MockRepo;

  beforeEach(async () => {
    videoRepo = makeRepoMock();
    providerRepo = makeRepoMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VerificationVideosService,
        { provide: getRepositoryToken(VerificationVideo), useValue: videoRepo },
        { provide: getRepositoryToken(Provider), useValue: providerRepo },
      ],
    }).compile();

    service = module.get<VerificationVideosService>(VerificationVideosService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('uploadVideo', () => {
    it('should throw BadRequestException for duration < 5s', async () => {
      await expect(
        service.uploadVideo('u1', 'url', 3),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for duration > 60s', async () => {
      await expect(
        service.uploadVideo('u1', 'url', 61),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when provider not found', async () => {
      providerRepo.findOne.mockResolvedValue(null);

      await expect(
        service.uploadVideo('u1', 'url', 30),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when pending video exists', async () => {
      providerRepo.findOne.mockResolvedValue({ id: 'p1' });
      videoRepo.findOne.mockResolvedValue({ status: VerificationVideoStatus.PENDING });

      await expect(
        service.uploadVideo('u1', 'url', 30),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create and save video', async () => {
      providerRepo.findOne.mockResolvedValue({ id: 'p1' });
      videoRepo.findOne.mockResolvedValue(null);

      await service.uploadVideo('u1', 'http://video.mp4', 30, 'http://thumb.jpg');

      expect(videoRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ durationSeconds: 30 }),
      );
      expect(videoRepo.save).toHaveBeenCalled();
    });
  });

  describe('getProviderVideo', () => {
    it('should return video for a provider', async () => {
      videoRepo.findOne.mockResolvedValue({ id: 'v1' });

      const result = await service.getProviderVideo('p1');
      expect(result.id).toBe('v1');
    });
  });

  describe('getPendingVideos', () => {
    it('should return pending videos', async () => {
      videoRepo.find.mockResolvedValue([{ id: 'v1' }]);

      const result = await service.getPendingVideos();
      expect(result).toHaveLength(1);
    });
  });

  describe('reviewVideo', () => {
    it('should throw NotFoundException when video not found', async () => {
      videoRepo.findOne.mockResolvedValue(null);

      await expect(
        service.reviewVideo('v1', VerificationVideoStatus.APPROVED),
      ).rejects.toThrow(NotFoundException);
    });

    it('should update video status and reviewedAt', async () => {
      const video = { id: 'v1', status: VerificationVideoStatus.PENDING };
      videoRepo.findOne.mockResolvedValue(video);

      await service.reviewVideo('v1', VerificationVideoStatus.APPROVED, 'Good quality');

      expect(video.status).toBe(VerificationVideoStatus.APPROVED);
      expect(video.reviewedAt).toBeDefined();
      expect(videoRepo.save).toHaveBeenCalled();
    });
  });
});
