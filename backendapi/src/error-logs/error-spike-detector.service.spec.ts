import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ErrorSpikeDetector } from './error-spike-detector.service';
import { ErrorLog } from './entities/error-log.entity';

describe('ErrorSpikeDetector', () => {
  let service: ErrorSpikeDetector;
  let repo: { count: jest.Mock };

  beforeEach(async () => {
    repo = { count: jest.fn().mockResolvedValue(0) };
    process.env.SLACK_WEBHOOK_URL = '';
    process.env.ERROR_SPIKE_THRESHOLD = '50';

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ErrorSpikeDetector,
        { provide: getRepositoryToken(ErrorLog), useValue: repo },
      ],
    }).compile();
    service = module.get<ErrorSpikeDetector>(ErrorSpikeDetector);
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete process.env.SLACK_WEBHOOK_URL;
  });

  it('should do nothing when no webhook configured', async () => {
    await service.checkSpike();
    expect(repo.count).not.toHaveBeenCalled();
  });

  it('should do nothing when error count is below threshold', async () => {
    process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/test';
    repo.count.mockResolvedValue(10);

    await service.checkSpike();
    expect(repo.count).toHaveBeenCalled();
  });
});
