import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DynamicPricingService, PricingRule } from './dynamic-pricing.service';
import { ServiceCategory } from '../services/entities/service-category.entity';
import { Booking } from '../bookings/entities/booking.entity';

type MockRepo = {
  find: jest.Mock;
  findOne: jest.Mock;
  create: jest.Mock;
  save: jest.Mock;
  createQueryBuilder: jest.Mock;
};

function makeRepoMock(): MockRepo {
  const qb: any = {
    leftJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getCount: jest.fn().mockResolvedValue(0),
  };
  return {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn(),
    create: jest.fn((x) => x),
    save: jest.fn((x) => Promise.resolve(x)),
    createQueryBuilder: jest.fn().mockReturnValue(qb),
  };
}

describe('DynamicPricingService', () => {
  let service: DynamicPricingService;
  let bookingRepo: MockRepo;

  beforeEach(async () => {
    bookingRepo = makeRepoMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DynamicPricingService,
        { provide: getRepositoryToken(ServiceCategory), useValue: makeRepoMock() },
        { provide: getRepositoryToken(Booking), useValue: bookingRepo },
      ],
    }).compile();

    service = module.get<DynamicPricingService>(DynamicPricingService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('calculatePrice', () => {
    it('should return base amount with no multipliers for a weekday non-peak non-holiday', async () => {
      // 2026-07-06 is Monday, 10:00 AM
      const date = new Date(2026, 6, 6, 10, 0, 0);
      const result = await service.calculatePrice({ baseAmount: 500, scheduledDate: date });
      expect(result.baseAmount).toBe(500);
      expect(result.finalAmount).toBe(500);
      expect(result.appliedMultipliers).toHaveLength(0);
    });

    it('should apply peak hours multiplier for 5-9 PM', async () => {
      const date = new Date(2026, 6, 6, 18, 0, 0); // Monday 6 PM
      const result = await service.calculatePrice({ baseAmount: 1000, scheduledDate: date });
      expect(result.appliedMultipliers.length).toBeGreaterThanOrEqual(1);
      expect(result.appliedMultipliers[0].rule).toBe(PricingRule.PEAK_HOURS);
      expect(result.finalAmount).toBe(1200); // 1000 * 1.2
    });

    it('should apply weekend multiplier for Saturday', async () => {
      // 2026-07-11 is Saturday
      const date = new Date(2026, 6, 11, 10, 0, 0);
      const result = await service.calculatePrice({ baseAmount: 1000, scheduledDate: date });
      expect(result.appliedMultipliers.length).toBeGreaterThanOrEqual(1);
      const weekendRule = result.appliedMultipliers.find((m) => m.rule === PricingRule.WEEKEND);
      expect(weekendRule).toBeDefined();
    });

    it('should apply holiday multiplier on Republic Day', async () => {
      // Jan 26 = Republic Day, 2026-01-26 is Monday
      const date = new Date(2026, 0, 26, 10, 0, 0);
      const result = await service.calculatePrice({ baseAmount: 1000, scheduledDate: date });
      const holidayRule = result.appliedMultipliers.find((m) => m.rule === PricingRule.HOLIDAY);
      expect(holidayRule).toBeDefined();
    });

    it('should apply multiple multipliers for peak + weekend', async () => {
      // 2026-07-11 is Saturday, 18:00 is peak
      const date = new Date(2026, 6, 11, 18, 0, 0);
      const result = await service.calculatePrice({ baseAmount: 1000, scheduledDate: date });
      const rules = result.appliedMultipliers.map((m) => m.rule);
      expect(rules).toContain(PricingRule.PEAK_HOURS);
      expect(rules).toContain(PricingRule.WEEKEND);
      // 1000 * 1.2 * 1.15 = 1380
      expect(result.finalAmount).toBe(1380);
    });

    it('should apply high demand multiplier when bookings >= 5', async () => {
      bookingRepo.createQueryBuilder().getCount.mockResolvedValue(5);
      const date = new Date(2026, 6, 6, 10, 0, 0); // Monday, non-peak, non-holiday
      const result = await service.calculatePrice({
        baseAmount: 1000,
        scheduledDate: date,
        categoryId: 'cat-1',
      });
      const hdRule = result.appliedMultipliers.find((m) => m.rule === PricingRule.HIGH_DEMAND);
      expect(hdRule).toBeDefined();
      expect(result.finalAmount).toBe(1300); // 1000 * 1.3
    });

    it('should not apply high demand when no categoryId', async () => {
      const date = new Date(2026, 6, 6, 10, 0, 0);
      const result = await service.calculatePrice({ baseAmount: 1000, scheduledDate: date });
      expect(result.appliedMultipliers).toHaveLength(0);
    });
  });

  describe('getPricingPreview', () => {
    it('should delegate to calculatePrice', async () => {
      const date = new Date(2026, 6, 6, 10, 0, 0);
      const result = await service.getPricingPreview(500, date);
      expect(result.baseAmount).toBe(500);
      expect(result.finalAmount).toBe(500);
    });
  });
});
