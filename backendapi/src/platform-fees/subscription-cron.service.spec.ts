import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SubscriptionCronService } from './subscription-cron.service';
import { ProviderSubscription } from './entities/provider-subscription.entity';
import { ProviderSubscriptionPlan } from './entities/provider-subscription-plan.entity';
import { CustomerMembership } from './entities/customer-membership.entity';
import { CustomerMembershipPlan } from './entities/customer-membership-plan.entity';

type MockRepo = {
  find: jest.Mock;
  update: jest.Mock;
  save: jest.Mock;
};

function makeRepoMock(): MockRepo {
  return {
    find: jest.fn().mockResolvedValue([]),
    update: jest.fn().mockResolvedValue({ affected: 0 }),
    save: jest.fn((x) => Promise.resolve(x)),
  };
}

describe('SubscriptionCronService', () => {
  let service: SubscriptionCronService;
  let subRepo: MockRepo;
  let memRepo: MockRepo;

  beforeEach(async () => {
    subRepo = makeRepoMock();
    memRepo = makeRepoMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionCronService,
        { provide: getRepositoryToken(ProviderSubscription), useValue: subRepo },
        { provide: getRepositoryToken(ProviderSubscriptionPlan), useValue: makeRepoMock() },
        { provide: getRepositoryToken(CustomerMembership), useValue: memRepo },
        { provide: getRepositoryToken(CustomerMembershipPlan), useValue: makeRepoMock() },
      ],
    }).compile();

    service = module.get<SubscriptionCronService>(SubscriptionCronService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('expireSubscriptions', () => {
    it('should update expired subscriptions', async () => {
      subRepo.update.mockResolvedValue({ affected: 3 });

      await service.expireSubscriptions();

      expect(subRepo.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'active' }),
        expect.objectContaining({ status: 'expired' }),
      );
    });
  });

  describe('expireMemberships', () => {
    it('should update expired memberships', async () => {
      memRepo.update.mockResolvedValue({ affected: 2 });

      await service.expireMemberships();

      expect(memRepo.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'active' }),
        expect.objectContaining({ status: 'expired' }),
      );
    });
  });

  describe('processSubscriptionRenewals', () => {
    it('should renew subscriptions ending soon', async () => {
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 1);

      subRepo.find.mockResolvedValue([
        {
          id: 'sub1',
          endDate,
          startDate: new Date(),
          amountPaid: 100,
          plan: { durationMonths: 1, extraDays: 0 },
        },
      ]);

      await service.processSubscriptionRenewals();

      expect(subRepo.save).toHaveBeenCalled();
    });

    it('should handle empty renewals gracefully', async () => {
      subRepo.find.mockResolvedValue([]);

      await service.processSubscriptionRenewals();

      expect(subRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('processMembershipRenewals', () => {
    it('should renew memberships ending soon', async () => {
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 1);

      memRepo.find.mockResolvedValue([
        {
          id: 'mem1',
          endDate,
          startDate: new Date(),
          amountPaid: 50,
          billingCycle: 'monthly',
        },
      ]);

      await service.processMembershipRenewals();

      expect(memRepo.save).toHaveBeenCalled();
    });

    it('should handle yearly billing cycle', async () => {
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 1);

      memRepo.find.mockResolvedValue([
        {
          id: 'mem2',
          endDate,
          startDate: new Date(),
          amountPaid: 500,
          billingCycle: 'yearly',
        },
      ]);

      await service.processMembershipRenewals();

      expect(memRepo.save).toHaveBeenCalled();
    });
  });
});
