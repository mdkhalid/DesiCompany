import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CommissionService } from './commission.service';
import { CommissionConfig } from './entities/commission-config.entity';
import { CommissionType } from '../common/enums/commission-type.enum';
import { SettingsService } from '../settings/settings.service';
import { PlatformFeesService } from '../platform-fees/platform-fees.service';

type MockRepo = {
  findOne: jest.Mock;
  find: jest.Mock;
  save: jest.Mock;
  create: jest.Mock;
};

function makeRepoMock(): MockRepo {
  return {
    findOne: jest.fn(),
    find: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;

describe('CommissionService - grace period waiver', () => {
  let service: CommissionService;
  let commissionRepo: MockRepo;
  const settings = {
    isProviderGraceCommissionWaiverEnabled: jest.fn(),
    getProviderGracePeriodDays: jest.fn(),
  };

  beforeEach(async () => {
    commissionRepo = makeRepoMock();
    // Default: a global 10% commission config.
    commissionRepo.findOne.mockResolvedValue({
      type: CommissionType.PERCENTAGE,
      value: 10,
      isActive: true,
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommissionService,
        { provide: getRepositoryToken(CommissionConfig), useValue: commissionRepo },
        { provide: SettingsService, useValue: settings },
        { provide: PlatformFeesService, useValue: { getProviderSubscription: jest.fn() } },
      ],
    }).compile();

    service = module.get<CommissionService>(CommissionService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should waive commission (amount 0) when provider is within grace window', async () => {
    settings.isProviderGraceCommissionWaiverEnabled.mockResolvedValue(true);
    settings.getProviderGracePeriodDays.mockResolvedValue(7);

    const createdAt = new Date(Date.now() - 3 * DAY_MS);
    const result = await service.resolveCommission(1000, undefined, undefined, {
      providerCreatedAt: createdAt,
    });

    expect(result.amount).toBe(0);
    expect(result.waived).toBe(true);
    expect(result.waivedReason).toContain('grace period');
  });

  it('should NOT waive commission when provider is past the grace window', async () => {
    settings.isProviderGraceCommissionWaiverEnabled.mockResolvedValue(true);
    settings.getProviderGracePeriodDays.mockResolvedValue(7);

    const createdAt = new Date(Date.now() - 10 * DAY_MS);
    const result = await service.resolveCommission(1000, undefined, undefined, {
      providerCreatedAt: createdAt,
    });

    expect(result.amount).toBe(100);
    expect(result.waived).toBeFalsy();
  });

  it('should NOT waive commission when the waiver is disabled', async () => {
    settings.isProviderGraceCommissionWaiverEnabled.mockResolvedValue(false);
    settings.getProviderGracePeriodDays.mockResolvedValue(7);

    const createdAt = new Date(Date.now() - 1 * DAY_MS);
    const result = await service.resolveCommission(1000, undefined, undefined, {
      providerCreatedAt: createdAt,
    });

    expect(result.amount).toBe(100);
    expect(result.waived).toBeFalsy();
  });

  it('should NOT waive commission when providerCreatedAt is missing', async () => {
    settings.isProviderGraceCommissionWaiverEnabled.mockResolvedValue(true);
    settings.getProviderGracePeriodDays.mockResolvedValue(7);

    const result = await service.resolveCommission(1000);

    expect(result.amount).toBe(100);
    expect(result.waived).toBeFalsy();
  });

  it('should exactly hit the boundary (day 7) still waived', async () => {
    settings.isProviderGraceCommissionWaiverEnabled.mockResolvedValue(true);
    settings.getProviderGracePeriodDays.mockResolvedValue(7);

    const createdAt = new Date(Date.now() - 7 * DAY_MS + 60 * 1000); // just inside
    const result = await service.resolveCommission(1000, undefined, undefined, {
      providerCreatedAt: createdAt,
    });

    expect(result.amount).toBe(0);
    expect(result.waived).toBe(true);
  });
});
