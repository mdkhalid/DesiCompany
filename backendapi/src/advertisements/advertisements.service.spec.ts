import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Repository, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { AdvertisementsService } from './advertisements.service';
import {
  Advertisement,
  AdPlacement,
  AdStatus,
  AdTargetAudience,
} from './entities/advertisement.entity';

describe('AdvertisementsService', () => {
  let service: AdvertisementsService;
  let adRepo: jest.Mocked<Repository<Advertisement>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdvertisementsService,
        {
          provide: getRepositoryToken(Advertisement),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            remove: jest.fn(),
            count: jest.fn(),
            createQueryBuilder: jest.fn(() => ({
              where: jest.fn().mockReturnThis(),
              andWhere: jest.fn().mockReturnThis(),
              orderBy: jest.fn().mockReturnThis(),
              addOrderBy: jest.fn().mockReturnThis(),
              getMany: jest.fn(),
              select: jest.fn().mockReturnThis(),
              getRawOne: jest.fn(),
              update: jest.fn().mockReturnThis(),
              set: jest.fn().mockReturnThis(),
              execute: jest.fn(),
            })),
          },
        },
      ],
    }).compile();

    service = module.get(AdvertisementsService);
    adRepo = module.get(getRepositoryToken(Advertisement));
  });

  describe('createAd', () => {
    it('creates advertisement successfully', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);

      adRepo.create.mockReturnValue({
        id: 'ad-1',
        title: 'Test Ad',
        status: AdStatus.ACTIVE,
      } as Advertisement);
      adRepo.save.mockResolvedValue({
        id: 'ad-1',
        title: 'Test Ad',
        status: AdStatus.ACTIVE,
      } as Advertisement);

      const result = await service.createAd('admin-1', {
        title: 'Test Ad',
        imageUrl: 'https://example.com/image.jpg',
        placement: AdPlacement.HOME_BANNER,
        startDate: new Date(),
        endDate: futureDate,
      });

      expect(result.title).toBe('Test Ad');
      expect(result.status).toBe(AdStatus.ACTIVE);
    });

    it('throws BadRequestException when end date is before start date', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      await expect(
        service.createAd('admin-1', {
          title: 'Test Ad',
          imageUrl: 'https://example.com/image.jpg',
          placement: AdPlacement.HOME_BANNER,
          startDate: new Date(),
          endDate: pastDate,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('sets scheduled status when start date is in future', async () => {
      const futureStart = new Date();
      futureStart.setDate(futureStart.getDate() + 1);
      const futureEnd = new Date();
      futureEnd.setDate(futureEnd.getDate() + 7);

      adRepo.create.mockReturnValue({
        id: 'ad-1',
        title: 'Test Ad',
        status: AdStatus.SCHEDULED,
      } as Advertisement);
      adRepo.save.mockResolvedValue({
        id: 'ad-1',
        title: 'Test Ad',
        status: AdStatus.SCHEDULED,
      } as Advertisement);

      const result = await service.createAd('admin-1', {
        title: 'Test Ad',
        imageUrl: 'https://example.com/image.jpg',
        placement: AdPlacement.HOME_BANNER,
        startDate: futureStart,
        endDate: futureEnd,
      });

      expect(result.status).toBe(AdStatus.SCHEDULED);
    });
  });

  describe('updateAd', () => {
    it('updates advertisement successfully', async () => {
      adRepo.findOne.mockResolvedValue({
        id: 'ad-1',
        title: 'Old Title',
        startDate: new Date(),
        endDate: new Date(),
      } as Advertisement);
      adRepo.save.mockResolvedValue({
        id: 'ad-1',
        title: 'New Title',
      } as Advertisement);

      const result = await service.updateAd('ad-1', { title: 'New Title' });
      expect(result.title).toBe('New Title');
    });

    it('throws NotFoundException when ad not found', async () => {
      adRepo.findOne.mockResolvedValue(null);
      await expect(service.updateAd('unknown', { title: 'Test' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('deleteAd', () => {
    it('deletes advertisement successfully', async () => {
      adRepo.findOne.mockResolvedValue({ id: 'ad-1' } as Advertisement);
      adRepo.remove.mockResolvedValue({ id: 'ad-1' } as Advertisement);

      const result = await service.deleteAd('ad-1');
      expect(result.success).toBe(true);
    });

    it('throws NotFoundException when ad not found', async () => {
      adRepo.findOne.mockResolvedValue(null);
      await expect(service.deleteAd('unknown')).rejects.toThrow(NotFoundException);
    });
  });

  describe('pauseAd', () => {
    it('pauses active advertisement', async () => {
      adRepo.findOne.mockResolvedValue({
        id: 'ad-1',
        status: AdStatus.ACTIVE,
      } as Advertisement);
      adRepo.save.mockResolvedValue({
        id: 'ad-1',
        status: AdStatus.PAUSED,
      } as Advertisement);

      const result = await service.pauseAd('ad-1');
      expect(result.status).toBe(AdStatus.PAUSED);
    });
  });

  describe('resumeAd', () => {
    it('resumes paused advertisement', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);

      adRepo.findOne.mockResolvedValue({
        id: 'ad-1',
        status: AdStatus.PAUSED,
        startDate: new Date(),
        endDate: futureDate,
      } as Advertisement);
      adRepo.save.mockResolvedValue({
        id: 'ad-1',
        status: AdStatus.ACTIVE,
      } as Advertisement);

      const result = await service.resumeAd('ad-1');
      expect(result.status).toBe(AdStatus.ACTIVE);
    });

    it('throws BadRequestException when ad is expired', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      adRepo.findOne.mockResolvedValue({
        id: 'ad-1',
        status: AdStatus.PAUSED,
        endDate: pastDate,
      } as Advertisement);

      await expect(service.resumeAd('ad-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('recordImpression', () => {
    it('increments impression count', async () => {
      adRepo.findOne.mockResolvedValue({
        id: 'ad-1',
        impressions: 10,
        maxImpressions: null,
      } as Advertisement);
      adRepo.save.mockResolvedValue({
        id: 'ad-1',
        impressions: 11,
      } as Advertisement);

      await service.recordImpression('ad-1');
      expect(adRepo.save).toHaveBeenCalled();
    });

    it('expires ad when max impressions reached', async () => {
      adRepo.findOne.mockResolvedValue({
        id: 'ad-1',
        impressions: 99,
        maxImpressions: 100,
      } as Advertisement);
      adRepo.save.mockResolvedValue({
        id: 'ad-1',
        impressions: 100,
        status: AdStatus.EXPIRED,
      } as Advertisement);

      await service.recordImpression('ad-1');
      expect(adRepo.save).toHaveBeenCalled();
    });
  });

  describe('recordClick', () => {
    it('increments click count', async () => {
      adRepo.findOne.mockResolvedValue({
        id: 'ad-1',
        clicks: 5,
        maxClicks: null,
      } as Advertisement);
      adRepo.save.mockResolvedValue({
        id: 'ad-1',
        clicks: 6,
      } as Advertisement);

      await service.recordClick('ad-1');
      expect(adRepo.save).toHaveBeenCalled();
    });
  });

  describe('getAdAnalytics', () => {
    it('returns analytics data', async () => {
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 30);

      adRepo.findOne.mockResolvedValue({
        id: 'ad-1',
        title: 'Test Ad',
        status: AdStatus.ACTIVE,
        placement: AdPlacement.HOME_BANNER,
        impressions: 1000,
        clicks: 50,
        maxImpressions: 10000,
        maxClicks: 500,
        startDate,
        endDate,
        dailyImpressionLimit: 100,
      } as Advertisement);

      const result = await service.getAdAnalytics('ad-1');
      expect(result.impressions).toBe(1000);
      expect(result.clicks).toBe(50);
      expect(result.ctr).toBe('5.00');
    });

    it('throws NotFoundException when ad not found', async () => {
      adRepo.findOne.mockResolvedValue(null);
      await expect(service.getAdAnalytics('unknown')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getDashboardStats', () => {
    it('returns dashboard statistics', async () => {
      adRepo.count
        .mockResolvedValueOnce(10)  // total
        .mockResolvedValueOnce(5)   // active
        .mockResolvedValueOnce(2)   // scheduled
        .mockResolvedValueOnce(1)   // paused
        .mockResolvedValueOnce(2);  // expired

      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ sum: '5000' }),
      };
      adRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      const result = await service.getDashboardStats();
      expect(result.total).toBe(10);
      expect(result.active).toBe(5);
    });
  });
});
