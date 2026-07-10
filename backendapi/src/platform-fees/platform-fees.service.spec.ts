import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Repository, DataSource } from 'typeorm';
import { PlatformFeesService } from './platform-fees.service';
import { PlatformFeeConfig } from './entities/platform-fee-config.entity';
import { ProviderSubscriptionPlan } from './entities/provider-subscription-plan.entity';
import { ProviderSubscription } from './entities/provider-subscription.entity';
import { PromoCode } from './entities/promo-code.entity';
import { PromoCodeUsage } from './entities/promo-code-usage.entity';
import { CustomerMembershipPlan } from './entities/customer-membership-plan.entity';
import { CustomerMembership } from './entities/customer-membership.entity';
import { Provider } from '../users/entities/provider.entity';
import { User } from '../users/entities/user.entity';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';
import { PromoCodeType } from './enums/platform-fee.enum';

type MockRepo = {
  find: jest.Mock;
  findOne: jest.Mock;
  create: jest.Mock;
  save: jest.Mock;
  remove: jest.Mock;
  update: jest.Mock;
  increment: jest.Mock;
  manager: {
    createQueryBuilder: jest.Mock;
  };
  createQueryBuilder: jest.Mock;
};

function makeRepoMock(): MockRepo {
  return {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
    update: jest.fn(),
    increment: jest.fn(),
    manager: {
      createQueryBuilder: jest.fn(),
    },
    createQueryBuilder: jest.fn(),
  };
}

describe('PlatformFeesService', () => {
  let service: PlatformFeesService;
  let feeConfigRepo: MockRepo;
  let planRepo: MockRepo;
  let subscriptionRepo: MockRepo;
  let promoCodeRepo: MockRepo;
  let promoCodeUsageRepo: MockRepo;
  let membershipPlanRepo: MockRepo;
  let customerMembershipRepo: MockRepo;
  let providerRepo: MockRepo;
  let userRepo: MockRepo;
  let activityLogsService: jest.Mocked<ActivityLogsService>;

  beforeEach(async () => {
    feeConfigRepo = makeRepoMock();
    planRepo = makeRepoMock();
    subscriptionRepo = makeRepoMock();
    promoCodeRepo = makeRepoMock();
    promoCodeUsageRepo = makeRepoMock();
    membershipPlanRepo = makeRepoMock();
    customerMembershipRepo = makeRepoMock();
    providerRepo = makeRepoMock();
    userRepo = makeRepoMock();
    activityLogsService = {
      log: jest.fn().mockResolvedValue(undefined),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlatformFeesService,
        {
          provide: getRepositoryToken(PlatformFeeConfig),
          useValue: feeConfigRepo,
        },
        {
          provide: getRepositoryToken(ProviderSubscriptionPlan),
          useValue: planRepo,
        },
        {
          provide: getRepositoryToken(ProviderSubscription),
          useValue: subscriptionRepo,
        },
        { provide: getRepositoryToken(PromoCode), useValue: promoCodeRepo },
        {
          provide: getRepositoryToken(PromoCodeUsage),
          useValue: promoCodeUsageRepo,
        },
        {
          provide: getRepositoryToken(CustomerMembershipPlan),
          useValue: membershipPlanRepo,
        },
        {
          provide: getRepositoryToken(CustomerMembership),
          useValue: customerMembershipRepo,
        },
        { provide: getRepositoryToken(Provider), useValue: providerRepo },
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: ActivityLogsService, useValue: activityLogsService },
        {
          provide: DataSource,
          useValue: {
            transaction: jest.fn().mockImplementation((cb) => cb({ update: jest.fn(), create: jest.fn(), save: jest.fn().mockResolvedValue({}) })),
          },
        },
      ],
    }).compile();

    service = module.get(PlatformFeesService);
  });

  describe('Fee Config', () => {
    it('getAllConfigs returns all configs', async () => {
      feeConfigRepo.find.mockResolvedValue([{ configKey: 'test' }]);
      const result = await service.getAllConfigs();
      expect(result).toEqual([{ configKey: 'test' }]);
    });

    it('getConfig returns config by key', async () => {
      feeConfigRepo.findOne.mockResolvedValue({ configKey: 'convenience_fee' });
      const result = await service.getConfig('convenience_fee');
      expect(result).toEqual({ configKey: 'convenience_fee' });
    });

    it('getConfig returns null when not found', async () => {
      feeConfigRepo.findOne.mockResolvedValue(null);
      const result = await service.getConfig('nonexistent');
      expect(result).toBeNull();
    });

    it('updateConfig replaces configValue entirely', async () => {
      const existing = {
        configKey: 'test',
        configValue: { type: 'fixed' },
        isActive: true,
      };
      feeConfigRepo.findOne.mockResolvedValue(existing);
      feeConfigRepo.save.mockImplementation((e: any) => Promise.resolve(e));

      const result = await service.updateConfig(
        'test',
        { value: 50 },
        undefined,
        'admin-1',
      );
      expect(result.configValue).toEqual({ value: 50 }); // replaces entirely
      expect(activityLogsService.log).toHaveBeenCalled();
    });

    it('updateConfig throws NotFound when config missing', async () => {
      feeConfigRepo.findOne.mockResolvedValue(null);
      await expect(service.updateConfig('missing', {})).rejects.toThrow(
        NotFoundException,
      );
    });

    it('isFeatureEnabled returns true only when active and enabled', () => {
      expect(
        service.isFeatureEnabled({
          configKey: 'x',
          configValue: { enabled: true },
          isActive: true,
        } as any),
      ).toBe(true);
      expect(
        service.isFeatureEnabled({
          configKey: 'x',
          configValue: { enabled: false },
          isActive: true,
        } as any),
      ).toBe(false);
      expect(
        service.isFeatureEnabled({
          configKey: 'x',
          configValue: { enabled: true },
          isActive: false,
        } as any),
      ).toBe(false);
      expect(service.isFeatureEnabled(null)).toBe(false);
    });
  });

  describe('Convenience Fee', () => {
    it('returns zero when feature is disabled', async () => {
      feeConfigRepo.findOne.mockResolvedValue({
        configKey: 'feature_convenience_fee',
        configValue: { enabled: false },
        isActive: true,
      });
      const result = await service.getConvenienceFee(1000);
      expect(result).toEqual({ baseFee: 0, discount: 0, finalFee: 0 });
    });

    it('calculates percentage fee', async () => {
      feeConfigRepo.findOne
        .mockResolvedValueOnce({
          configKey: 'feature_convenience_fee',
          configValue: { enabled: true },
          isActive: true,
        })
        .mockResolvedValueOnce({
          configKey: 'convenience_fee',
          isActive: true,
          configValue: {
            type: 'percentage',
            value: 5,
            minAmount: 10,
            maxAmount: 200,
          },
        });
      const result = await service.getConvenienceFee(1000);
      expect(result.baseFee).toBe(50);
      expect(result.finalFee).toBe(50);
    });

    it('applies min/max caps', async () => {
      feeConfigRepo.findOne
        .mockResolvedValueOnce({
          configKey: 'feature_convenience_fee',
          configValue: { enabled: true },
          isActive: true,
        })
        .mockResolvedValueOnce({
          configKey: 'convenience_fee',
          isActive: true,
          configValue: {
            type: 'fixed',
            value: 5,
            minAmount: 10,
            maxAmount: 30,
          },
        });
      const result = await service.getConvenienceFee(100);
      expect(result.baseFee).toBe(10); // capped to min
      expect(result.finalFee).toBe(10);
    });

    it('applies fixed fee', async () => {
      feeConfigRepo.findOne
        .mockResolvedValueOnce({
          configKey: 'feature_convenience_fee',
          configValue: { enabled: true },
          isActive: true,
        })
        .mockResolvedValueOnce({
          configKey: 'convenience_fee',
          isActive: true,
          configValue: { type: 'fixed', value: 25, minAmount: 0, maxAmount: 0 },
        });
      const result = await service.getConvenienceFee(500);
      expect(result.baseFee).toBe(25);
    });
  });

  describe('Subscription Plans', () => {
    const dto = {
      name: 'Pro',
      price: 499,
      durationMonths: 1,
      benefits: { commissionDiscount: 20 },
    };

    it('creates a plan', async () => {
      planRepo.create.mockReturnValue(dto as any);
      planRepo.save.mockResolvedValue(dto as any);
      const result = await service.createSubscriptionPlan(dto);
      expect(result).toEqual(dto);
    });

    it('gets all plans', async () => {
      planRepo.find.mockResolvedValue([dto]);
      const result = await service.getAllSubscriptionPlans();
      expect(result).toEqual([dto]);
    });

    it('updates a plan', async () => {
      planRepo.findOne.mockResolvedValue({ id: 'p1', name: 'Basic' });
      planRepo.save.mockImplementation((e: any) => Promise.resolve(e));
      const result = await service.updateSubscriptionPlan('p1', {
        name: 'Premium',
      });
      expect(result.name).toBe('Premium');
    });

    it('throws on update when not found', async () => {
      planRepo.findOne.mockResolvedValue(null);
      await expect(
        service.updateSubscriptionPlan('x', { name: 'X' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('deletes a plan', async () => {
      planRepo.findOne.mockResolvedValue({ id: 'p1' });
      await service.deleteSubscriptionPlan('p1');
      expect(planRepo.remove).toHaveBeenCalled();
    });
  });

  describe('Provider Subscriptions', () => {
    it('assigns a subscription to a provider', async () => {
      providerRepo.findOne.mockResolvedValue({ id: 'prov-1' });
      planRepo.findOne.mockResolvedValue({ id: 'plan-1', name: 'Pro' });
      subscriptionRepo.update.mockResolvedValue(undefined);
      subscriptionRepo.create.mockReturnValue({
        id: 'sub-1',
        status: 'active',
      } as any);
      subscriptionRepo.save.mockResolvedValue({
        id: 'sub-1',
        status: 'active',
      } as any);

      const result = await service.assignSubscription(
        'prov-1',
        'plan-1',
        'admin-1',
      );
      expect(result.status).toBe('active');
      expect(activityLogsService.log).toHaveBeenCalled();
    });

    it('gets provider subscription', async () => {
      subscriptionRepo.findOne.mockResolvedValue({
        id: 'sub-1',
        plan: { name: 'Pro' },
      });
      const result = await service.getProviderSubscription('prov-1');
      expect(result).toEqual({ id: 'sub-1', plan: { name: 'Pro' } });
    });

    it('cancels a subscription', async () => {
      subscriptionRepo.findOne.mockResolvedValue({
        id: 'sub-1',
        plan: { name: 'Pro' },
        status: 'active',
      });
      subscriptionRepo.save.mockImplementation((e: any) => Promise.resolve(e));
      await service.cancelSubscription('sub-1', 'admin-1');
      expect(activityLogsService.log).toHaveBeenCalled();
    });
  });

  describe('Promo Codes', () => {
    const dto = {
      code: 'SAVE20',
      type: 'percentage',
      value: 20,
      maxUses: 100,
      validFrom: '2026-01-01',
      validUntil: '2026-12-31',
    };

    it('creates a promo code', async () => {
      promoCodeRepo.findOne.mockResolvedValue(null);
      promoCodeRepo.create.mockReturnValue({ code: 'SAVE20' } as any);
      promoCodeRepo.save.mockResolvedValue({ code: 'SAVE20' } as any);
      const result = await service.createPromoCode(dto);
      expect(result.code).toBe('SAVE20');
    });

    it('throws on duplicate code', async () => {
      promoCodeRepo.findOne.mockResolvedValue({ code: 'SAVE20' });
      await expect(service.createPromoCode(dto as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('gets all promo codes', async () => {
      promoCodeRepo.find.mockResolvedValue([{ code: 'SAVE20' }]);
      const result = await service.getAllPromoCodes();
      expect(result).toEqual([{ code: 'SAVE20' }]);
    });

    it('deletes a promo code', async () => {
      promoCodeRepo.findOne.mockResolvedValue({ id: 'pc-1' });
      await service.deletePromoCode('pc-1');
      expect(promoCodeRepo.remove).toHaveBeenCalled();
    });

    describe('validatePromoCode', () => {
      const activePromo = {
        code: 'SAVE10',
        type: 'percentage',
        value: 10,
        maxUses: 50,
        currentUses: 5,
        isActive: true,
        validFrom: new Date('2025-01-01'),
        validUntil: new Date('2030-12-31'),
        restrictions: {},
      };

      it('returns valid for active promo', async () => {
        feeConfigRepo.findOne.mockResolvedValue({
          configKey: 'feature_promo_codes',
          configValue: { enabled: true },
          isActive: true,
        });
        promoCodeRepo.findOne.mockResolvedValue(activePromo);
        const result = await service.validatePromoCode('SAVE10', 'user-1', 500);
        expect(result.valid).toBe(true);
        expect(result.discount).toBe(50); // 10% of 500
      });

      it('returns invalid when promo disabled', async () => {
        feeConfigRepo.findOne.mockResolvedValue({
          configKey: 'feature_promo_codes',
          configValue: { enabled: false },
          isActive: true,
        });
        const result = await service.validatePromoCode('SAVE10', 'user-1', 500);
        expect(result.valid).toBe(false);
      });

      it('returns invalid when code not found', async () => {
        feeConfigRepo.findOne.mockResolvedValue({
          configKey: 'feature_promo_codes',
          configValue: { enabled: true },
          isActive: true,
        });
        promoCodeRepo.findOne.mockResolvedValue(null);
        const result = await service.validatePromoCode(
          'INVALID',
          'user-1',
          500,
        );
        expect(result.valid).toBe(false);
        expect(result.message).toContain('Invalid');
      });

      it('returns fee_waiver discount as MAX_SAFE_INTEGER', async () => {
        feeConfigRepo.findOne.mockResolvedValue({
          configKey: 'feature_promo_codes',
          configValue: { enabled: true },
          isActive: true,
        });
        promoCodeRepo.findOne.mockResolvedValue({
          ...activePromo,
          type: 'fee_waiver',
          value: 0,
        });
        const result = await service.validatePromoCode('FREE', 'user-1', 500);
        expect(result.valid).toBe(true);
        expect(result.discount).toBe(Number.MAX_SAFE_INTEGER);
      });

      it('applies maxDiscount restriction', async () => {
        feeConfigRepo.findOne.mockResolvedValue({
          configKey: 'feature_promo_codes',
          configValue: { enabled: true },
          isActive: true,
        });
        promoCodeRepo.findOne.mockResolvedValue({
          ...activePromo,
          restrictions: { maxDiscount: 20 },
        });
        const result = await service.validatePromoCode(
          'SAVE10',
          'user-1',
          1000,
        );
        expect(result.discount).toBe(20);
      });

      it('rejects when min booking amount not met', async () => {
        feeConfigRepo.findOne.mockResolvedValue({
          configKey: 'feature_promo_codes',
          configValue: { enabled: true },
          isActive: true,
        });
        promoCodeRepo.findOne.mockResolvedValue({
          ...activePromo,
          restrictions: { minBookingAmount: 1000 },
        });
        const result = await service.validatePromoCode('SAVE10', 'user-1', 500);
        expect(result.valid).toBe(false);
      });
    });

    describe('recordPromoCodeUsage', () => {
      it('increments usage and creates record', async () => {
        promoCodeRepo.increment.mockResolvedValue(undefined);
        promoCodeUsageRepo.create.mockReturnValue({ id: 'usage-1' } as any);
        promoCodeUsageRepo.save.mockResolvedValue({ id: 'usage-1' } as any);

        await service.recordPromoCodeUsage('pc-1', 'user-1', 'book-1', 50);
        expect(promoCodeRepo.increment).toHaveBeenCalled();
        expect(promoCodeUsageRepo.save).toHaveBeenCalled();
      });
    });

    describe('getPromoCodeUsageHistory', () => {
      it('returns usage history', async () => {
        promoCodeUsageRepo.find.mockResolvedValue([
          { id: 'usage-1', discountAmount: 50 },
        ]);
        const result = await service.getPromoCodeUsageHistory('pc-1');
        expect(result).toEqual([{ id: 'usage-1', discountAmount: 50 }]);
      });
    });
  });

  describe('Revenue Stats', () => {
    it('returns revenue stats', async () => {
      const qbMock1 = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ total: 5000 }),
      };
      const qbMock2 = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ total: 200 }),
      };
      feeConfigRepo.manager.createQueryBuilder.mockReturnValueOnce(qbMock1);
      promoCodeUsageRepo.createQueryBuilder.mockReturnValue(qbMock2);

      const result = await service.getRevenueStats();
      expect(result.totalConvenienceFees).toBe(5000);
      expect(result.totalSubscriptionRevenue).toBe(0);
      expect(result.totalDiscounts).toBe(200);
    });
  });

  describe('Instant Payout Fee', () => {
    it('returns zero when feature disabled', async () => {
      feeConfigRepo.findOne.mockResolvedValue({
        configKey: 'feature_instant_payout',
        configValue: { enabled: false },
        isActive: true,
      });
      const result = await service.calculateInstantPayoutFee(1000);
      expect(result).toEqual({ baseFee: 0, finalFee: 0, netAmount: 1000 });
    });

    it('calculates percentage fee', async () => {
      feeConfigRepo.findOne
        .mockResolvedValueOnce({
          configKey: 'feature_instant_payout',
          configValue: { enabled: true },
          isActive: true,
        })
        .mockResolvedValueOnce({
          configKey: 'instant_payout_fee',
          isActive: true,
          configValue: {
            type: 'percentage',
            value: 2.5,
            minAmount: 5,
            maxAmount: 500,
          },
        });
      const result = await service.calculateInstantPayoutFee(1000);
      expect(result.baseFee).toBe(25);
      expect(result.finalFee).toBe(25);
      expect(result.netAmount).toBe(975);
    });

    it('applies min fee cap', async () => {
      feeConfigRepo.findOne
        .mockResolvedValueOnce({
          configKey: 'feature_instant_payout',
          configValue: { enabled: true },
          isActive: true,
        })
        .mockResolvedValueOnce({
          configKey: 'instant_payout_fee',
          isActive: true,
          configValue: {
            type: 'fixed',
            value: 2,
            minAmount: 10,
            maxAmount: 100,
          },
        });
      const result = await service.calculateInstantPayoutFee(50);
      expect(result.baseFee).toBe(10);
    });
  });

  describe('Lead/Quote Fee', () => {
    it('returns zero when feature disabled', async () => {
      feeConfigRepo.findOne.mockResolvedValue({
        configKey: 'feature_lead_quote_fee',
        configValue: { enabled: false },
        isActive: true,
      });
      const result = await service.calculateLeadQuoteFee(500);
      expect(result).toEqual({ baseFee: 0, finalFee: 0 });
    });

    it('returns zero when provider has subscription with free leads', async () => {
      feeConfigRepo.findOne
        .mockResolvedValueOnce({
          configKey: 'feature_lead_quote_fee',
          configValue: { enabled: true },
          isActive: true,
        })
        .mockResolvedValueOnce({
          configKey: 'lead_quote_fee',
          isActive: true,
          configValue: { type: 'fixed', value: 10 },
        });
      subscriptionRepo.findOne.mockResolvedValue({
        plan: { benefits: { freeLeads: 50 } },
      } as any);

      const result = await service.calculateLeadQuoteFee(500, 'prov-1');
      expect(result).toEqual({ baseFee: 0, finalFee: 0 });
    });

    it('calculates fixed fee when no free leads', async () => {
      feeConfigRepo.findOne
        .mockResolvedValueOnce({
          configKey: 'feature_lead_quote_fee',
          configValue: { enabled: true },
          isActive: true,
        })
        .mockResolvedValueOnce({
          configKey: 'lead_quote_fee',
          isActive: true,
          configValue: { type: 'fixed', value: 10 },
        });
      subscriptionRepo.findOne.mockResolvedValue(null);

      const result = await service.calculateLeadQuoteFee(500, 'prov-1');
      expect(result.baseFee).toBe(10);
    });
  });

  describe('Customer Membership Plans', () => {
    const dto = {
      name: 'Gold',
      monthlyPrice: 199,
      yearlyPrice: 1999,
      benefits: { feeWaiverPercent: 100 },
    };

    it('creates a membership plan', async () => {
      membershipPlanRepo.create.mockReturnValue(dto as any);
      membershipPlanRepo.save.mockResolvedValue(dto as any);
      const result = await service.createMembershipPlan(dto);
      expect(result).toEqual(dto);
    });

    it('gets all membership plans', async () => {
      membershipPlanRepo.find.mockResolvedValue([dto]);
      const result = await service.getAllMembershipPlans();
      expect(result).toEqual([dto]);
    });

    it('updates a membership plan', async () => {
      membershipPlanRepo.findOne.mockResolvedValue({
        id: 'mp-1',
        name: 'Silver',
      });
      membershipPlanRepo.save.mockImplementation((e: any) =>
        Promise.resolve(e),
      );
      const result = await service.updateMembershipPlan('mp-1', {
        name: 'Platinum',
      });
      expect(result.name).toBe('Platinum');
    });

    it('deletes a membership plan', async () => {
      membershipPlanRepo.findOne.mockResolvedValue({ id: 'mp-1' });
      await service.deleteMembershipPlan('mp-1');
      expect(membershipPlanRepo.remove).toHaveBeenCalled();
    });

    describe('assignCustomerMembership', () => {
      it('assigns monthly membership', async () => {
        userRepo.findOne.mockResolvedValue({ id: 'user-1' });
        membershipPlanRepo.findOne.mockResolvedValue({
          id: 'plan-1',
          name: 'Gold',
        });
        customerMembershipRepo.update.mockResolvedValue(undefined);
        customerMembershipRepo.create.mockReturnValue({
          id: 'cm-1',
          billingCycle: 'monthly',
        } as any);
        customerMembershipRepo.save.mockResolvedValue({
          id: 'cm-1',
          billingCycle: 'monthly',
        } as any);

        const result = await service.assignCustomerMembership(
          'user-1',
          'plan-1',
          'monthly',
          'admin-1',
        );
        expect(result.billingCycle).toBe('monthly');
        expect(activityLogsService.log).toHaveBeenCalled();
      });

      it('assigns yearly membership', async () => {
        userRepo.findOne.mockResolvedValue({ id: 'user-1' });
        membershipPlanRepo.findOne.mockResolvedValue({
          id: 'plan-1',
          name: 'Gold',
        });
        customerMembershipRepo.update.mockResolvedValue(undefined);
        customerMembershipRepo.create.mockReturnValue({
          id: 'cm-1',
          billingCycle: 'yearly',
        } as any);
        customerMembershipRepo.save.mockResolvedValue({
          id: 'cm-1',
          billingCycle: 'yearly',
        } as any);

        const result = await service.assignCustomerMembership(
          'user-1',
          'plan-1',
          'yearly',
          'admin-1',
        );
        expect(result.billingCycle).toBe('yearly');
      });
    });

    describe('getCustomerFeeWaiver', () => {
      it('returns waiver when membership has feeWaiverPercent', async () => {
        customerMembershipRepo.findOne.mockResolvedValue({
          plan: { benefits: { feeWaiverPercent: 100 } },
        } as any);
        const result = await service.getCustomerFeeWaiver('cust-1');
        expect(result).toEqual({ hasWaiver: true, waiverPercent: 100 });
      });

      it('returns no waiver when no membership', async () => {
        customerMembershipRepo.findOne.mockResolvedValue(null);
        const result = await service.getCustomerFeeWaiver('cust-1');
        expect(result).toEqual({ hasWaiver: false, waiverPercent: 0 });
      });
    });
  });
});
