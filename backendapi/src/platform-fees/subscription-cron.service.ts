import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, Between } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import { ProviderSubscription } from './entities/provider-subscription.entity';
import { ProviderSubscriptionPlan } from './entities/provider-subscription-plan.entity';
import { CustomerMembership } from './entities/customer-membership.entity';
import { CustomerMembershipPlan } from './entities/customer-membership-plan.entity';

@Injectable()
export class SubscriptionCronService {
  private readonly logger = new Logger(SubscriptionCronService.name);

  constructor(
    @InjectRepository(ProviderSubscription)
    private readonly subscriptionRepository: Repository<ProviderSubscription>,
    @InjectRepository(ProviderSubscriptionPlan)
    private readonly planRepository: Repository<ProviderSubscriptionPlan>,
    @InjectRepository(CustomerMembership)
    private readonly membershipRepository: Repository<CustomerMembership>,
    @InjectRepository(CustomerMembershipPlan)
    private readonly membershipPlanRepository: Repository<CustomerMembershipPlan>,
  ) {}

  @Cron('0 0 * * *')
  async expireSubscriptions() {
    this.logger.log('Expiring subscriptions past end date...');
    const result = await this.subscriptionRepository.update(
      {
        status: 'active',
        endDate: LessThan(new Date()),
      },
      { status: 'expired', cancelledAt: new Date() },
    );
    if (result.affected && result.affected > 0) {
      this.logger.log(`Expired ${result.affected} subscription(s)`);
    }
  }

  @Cron('0 1 * * *')
  async expireMemberships() {
    this.logger.log('Expiring memberships past end date...');
    const result = await this.membershipRepository.update(
      {
        status: 'active',
        endDate: LessThan(new Date()),
      },
      { status: 'expired', cancelledAt: new Date() },
    );
    if (result.affected && result.affected > 0) {
      this.logger.log(`Expired ${result.affected} membership(s)`);
    }
  }

  @Cron('0 6 * * *')
  async processSubscriptionRenewals() {
    this.logger.log('Processing subscription renewals...');
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const dueSubs = await this.subscriptionRepository.find({
      where: {
        status: 'active',
        autoRenew: true,
        endDate: Between(now, tomorrow),
      },
      relations: { provider: { user: true }, plan: true },
    });

    for (const sub of dueSubs) {
      try {
        const planDays =
          sub.plan.durationMonths * 30 + (sub.plan.extraDays || 0);
        const newEndDate = new Date(sub.endDate);
        newEndDate.setDate(newEndDate.getDate() + planDays);

        sub.startDate = sub.endDate;
        sub.endDate = newEndDate;
        sub.amountPaid = 0;
        await this.subscriptionRepository.save(sub);
        this.logger.log(
          `Renewed subscription ${sub.id} until ${newEndDate.toISOString()}`,
        );
      } catch (err) {
        this.logger.warn(
          `Failed to renew subscription ${sub.id}: ${(err as Error).message}`,
        );
      }
    }
  }

  @Cron('0 7 * * *')
  async processMembershipRenewals() {
    this.logger.log('Processing membership renewals...');
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const dueMems = await this.membershipRepository.find({
      where: {
        status: 'active',
        autoRenew: true,
        endDate: Between(now, tomorrow),
      },
      relations: { customer: true, plan: true },
    });

    for (const mem of dueMems) {
      try {
        const newEndDate = new Date(mem.endDate);
        if (mem.billingCycle === 'yearly') {
          newEndDate.setFullYear(newEndDate.getFullYear() + 1);
        } else {
          newEndDate.setMonth(newEndDate.getMonth() + 1);
        }

        mem.startDate = mem.endDate;
        mem.endDate = newEndDate;
        mem.amountPaid = 0;
        await this.membershipRepository.save(mem);
        this.logger.log(
          `Renewed membership ${mem.id} until ${newEndDate.toISOString()}`,
        );
      } catch (err) {
        this.logger.warn(
          `Failed to renew membership ${mem.id}: ${(err as Error).message}`,
        );
      }
    }
  }
}
