import { Test, TestingModule } from '@nestjs/testing';
import { MetricsService } from './metrics.service';

describe('MetricsService', () => {
  let service: MetricsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MetricsService],
    }).compile();
    service = module.get<MetricsService>(MetricsService);
  });

  it('should initialize with metrics', () => {
    expect(service.httpRequestDuration).toBeDefined();
    expect(service.httpRequestTotal).toBeDefined();
    expect(service.activeBookings).toBeDefined();
    expect(service.bookingsTotal).toBeDefined();
  });

  it('should return metrics string', async () => {
    const metrics = await service.getMetrics();
    expect(typeof metrics).toBe('string');
    expect(metrics).toContain('http_request_duration_seconds');
  });

  it('should expose new N6 observability metrics', () => {
    expect(service.wsConnections).toBeDefined();
    expect(service.queueDepth).toBeDefined();
    expect(service.cacheHits).toBeDefined();
    expect(service.cacheMisses).toBeDefined();
    expect(service.dbPoolConnections).toBeDefined();
  });

  it('should return content type', () => {
    const ct = service.getContentType();
    expect(ct).toContain('text');
  });
});
