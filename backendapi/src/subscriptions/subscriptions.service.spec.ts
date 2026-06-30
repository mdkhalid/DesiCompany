import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { SubscriptionsService } from './subscriptions.service';
import {
  Subscription,
  SubscriptionPlan,
  SubscriptionStatus,
  PLAN_FEATURES,
} from './entities/subscription.entity';
import { Provider } from '../users/entities/provider.entity';
import { Wallet } from '../payments/entities/wallet.entity';
import { Transaction } from '../payments/entities/transaction.entity';

describe('SubscriptionsService', () => {
  let service: SubscriptionsService;
  let subscriptionRepo: jest.Mocked<Repository<Subscription>>;
  let providerRepo: jest.Mocked<Repository<Provider>>;
  let walletRepo: jest.Mocked<Repository<Wallet>>;
  let transactionRepo: jest.Mocked<Repository<Transaction>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionsService,
        {
          provide: getRepositoryToken(Subscription),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            createQueryBuilder: jest.fn(() => ({
              update: jest.fn().mockReturnThis(),
              set: jest.fn().mockReturnThis(),
              where: jest.fn().mockReturnThis(),
              andWhere: jest.fn().mockReturnThis(),
              execute: jest.fn(),
            })),
          },
        },
        {
          provide: getRepositoryToken(Provider),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Wallet),
          useValue: {
            findOne: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Transaction),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(SubscriptionsService);
    subscriptionRepo = module.get(getRepositoryToken(Subscription));
    providerRepo = module.get(getRepositoryToken(Provider));
    walletRepo = module.get(getRepositoryToken(Wallet));
    transactionRepo = module.get(getRepositoryToken(Transaction));
  });

  describe('getPlans', () => {
    it('returns all subscription plans', async () => {
      const plans = await service.getPlans();
      expect(plans).toHaveLength(3);
      expect(plans.map((p) => p.id)).toEqual([
        SubscriptionPlan.BASIC,
        SubscriptionPlan.PRO,
        SubscriptionPlan.PREMIUM,
      ]);
    });

    it('includes correct prices for each plan', async () => {
      const plans = await service.getPlans();
      const basic = plans.find((p) => p.id === SubscriptionPlan.BASIC);
      const pro = plans.find((p) => p.id === SubscriptionPlan.PRO);
      const premium = plans.find((p) => p.id === SubscriptionPlan.PREMIUM);

      expect(basic?.price).toBe(499);
      expect(pro?.price).toBe(999);
      expect(premium?.price).toBe(1999);
    });
  });

  describe('getCurrentSubscription', () => {
    it('returns active subscription', async () => {
      providerRepo.findOne.mockResolvedValue({ id: 'provider-1' } as Provider);
      subscriptionRepo.findOne.mockResolvedValue({
        id: 'sub-1',
        plan: SubscriptionPlan.PRO,
        status: SubscriptionStatus.ACTIVE,
      } as Subscription);

      const result = await service.getCurrentSubscription('user-1');
      expect(result?.plan).toBe(SubscriptionPlan.PRO);
    });

    it('returns null when no active subscription', async () => {
      providerRepo.findOne.mockResolvedValue({ id: 'provider-1' } as Provider);
      subscriptionRepo.findOne.mockResolvedValue(null);

      const result = await service.getCurrentSubscription('user-1');
      expect(result).toBeNull();
    });

    it('throws NotFoundException when provider not found', async () => {
      providerRepo.findOne.mockResolvedValue(null);
      await expect(service.getCurrentSubscription('unknown')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('subscribe', () => {
    it('creates subscription successfully', async () => {
      providerRepo.findOne.mockResolvedValue({ id: 'provider-1' } as Provider);
      subscriptionRepo.findOne.mockResolvedValue(null);
      walletRepo.findOne.mockResolvedValue({
        id: 'wallet-1',
        balance: 2000,
        user: { id: 'user-1' },
      } as Wallet);
      walletRepo.save.mockResolvedValue({
        id: 'wallet-1',
        balance: 1001,
      } as Wallet);
      transactionRepo.create.mockReturnValue({ id: 'tx-1' } as Transaction);
      transactionRepo.save.mockResolvedValue({ id: 'tx-1' } as Transaction);
      subscriptionRepo.create.mockReturnValue({
        id: 'sub-1',
        plan: SubscriptionPlan.PRO,
      } as Subscription);
      subscriptionRepo.save.mockResolvedValue({
        id: 'sub-1',
        plan: SubscriptionPlan.PRO,
        status: SubscriptionStatus.ACTIVE,
      } as Subscription);

      const result = await service.subscribe('user-1', SubscriptionPlan.PRO);
      expect(result.plan).toBe(SubscriptionPlan.PRO);
      expect(result.status).toBe(SubscriptionStatus.ACTIVE);
    });

    it('throws BadRequestException when already subscribed', async () => {
      providerRepo.findOne.mockResolvedValue({ id: 'provider-1' } as Provider);
      subscriptionRepo.findOne.mockResolvedValue({
        id: 'existing-sub',
        status: SubscriptionStatus.ACTIVE,
      } as Subscription);

      await expect(
        service.subscribe('user-1', SubscriptionPlan.PRO),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when insufficient balance', async () => {
      providerRepo.findOne.mockResolvedValue({ id: 'provider-1' } as Provider);
      subscriptionRepo.findOne.mockResolvedValue(null);
      walletRepo.findOne.mockResolvedValue({
        id: 'wallet-1',
        balance: 100,
        user: { id: 'user-1' },
      } as Wallet);

      await expect(
        service.subscribe('user-1', SubscriptionPlan.PREMIUM),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('cancelSubscription', () => {
    it('cancels active subscription', async () => {
      providerRepo.findOne.mockResolvedValue({ id: 'provider-1' } as Provider);
      subscriptionRepo.findOne.mockResolvedValue({
        id: 'sub-1',
        status: SubscriptionStatus.ACTIVE,
      } as Subscription);
      subscriptionRepo.save.mockResolvedValue({
        id: 'sub-1',
        status: SubscriptionStatus.CANCELLED,
        cancelledAt: new Date(),
        autoRenew: false,
      } as Subscription);

      const result = await service.cancelSubscription('user-1');
      expect(result.status).toBe(SubscriptionStatus.CANCELLED);
      expect(result.autoRenew).toBe(false);
    });

    it('throws NotFoundException when no active subscription', async () => {
      providerRepo.findOne.mockResolvedValue({ id: 'provider-1' } as Provider);
      subscriptionRepo.findOne.mockResolvedValue(null);

      await expect(service.cancelSubscription('user-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getProviderSubscriptionBenefits', () => {
    it('returns benefits for active subscription', async () => {
      subscriptionRepo.findOne.mockResolvedValue({
        id: 'sub-1',
        plan: SubscriptionPlan.PRO,
        status: SubscriptionStatus.ACTIVE,
        endDate: new Date(),
        featuresSnapshot: PLAN_FEATURES[SubscriptionPlan.PRO],
      } as Subscription);

      const result = await service.getProviderSubscriptionBenefits('provider-1');
      expect(result.hasSubscription).toBe(true);
      expect(result.plan).toBe(SubscriptionPlan.PRO);
    });

    it('returns no subscription when none active', async () => {
      subscriptionRepo.findOne.mockResolvedValue(null);

      const result = await service.getProviderSubscriptionBenefits('provider-1');
      expect(result.hasSubscription).toBe(false);
      expect(result.plan).toBeNull();
    });
  });
});
