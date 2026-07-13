import { Test, TestingModule } from '@nestjs/testing';
import { CacheService } from './cache.service';
import { MetricsService } from '../monitoring/metrics.service';

describe('CacheService', () => {
  let service: CacheService;

  const mockMetricsService = {
    recordCacheHit: jest.fn(),
    recordCacheMiss: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CacheService,
        { provide: MetricsService, useValue: mockMetricsService },
      ],
    }).compile();

    service = module.get(CacheService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should return null when Redis is unavailable', async () => {
    const result = await service.get('any-key');
    expect(result).toBeNull();
  });

  it('set should not throw when Redis is unavailable', async () => {
    await expect(service.set('k', {a: 1})).resolves.toBeUndefined();
  });

  it('set should not throw with zero TTL', async () => {
    await expect(service.set('k', {a: 1}, 0)).resolves.toBeUndefined();
  });

  it('del should not throw when Redis is unavailable', async () => {
    await expect(service.del('k')).resolves.toBeUndefined();
  });

  it('invalidatePattern should not throw when Redis is unavailable', async () => {
    await expect(service.invalidatePattern('prefix:*')).resolves.toBeUndefined();
  });
});
