import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Subscription,
  SubscriptionPlan,
  SubscriptionStatus,
  PLAN_FEATURES,
} from './entities/subscription.entity';
import { Provider } from '../users/entities/provider.entity';
import { Wallet } from '../payments/entities/wallet.entity';
import { Transaction } from '../payments/entities/transaction.entity';

@Injectable()
export class SubscriptionsService {
  constructor(
    @InjectRepository(Subscription)
    private readonly subscriptionRepository: Repository<Subscription>,
    @InjectRepository(Provider)
    private readonly providerRepository: Repository<Provider>,
    @InjectRepository(Wallet)
    private readonly walletRepository: Repository<Wallet>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
  ) {}

  getPlans() {
    return Object.entries(PLAN_FEATURES).map(([key, value]) => ({
      id: key,
      ...value,
    }));
  }

  async getCurrentSubscription(userId: string) {
    const provider = await this.providerRepository.findOne({
      where: { user: { id: userId } },
    });
    if (!provider) throw new NotFoundException('Provider not found');

    const subscription = await this.subscriptionRepository.findOne({
      where: {
        provider: { id: provider.id },
        status: SubscriptionStatus.ACTIVE,
      },
      order: { endDate: 'DESC' },
    });

    return subscription || null;
  }

  async subscribe(userId: string, plan: SubscriptionPlan) {
    const provider = await this.providerRepository.findOne({
      where: { user: { id: userId } },
    });
    if (!provider) throw new NotFoundException('Provider not found');

    // Check for existing active subscription
    const existing = await this.subscriptionRepository.findOne({
      where: {
        provider: { id: provider.id },
        status: SubscriptionStatus.ACTIVE,
      },
    });

    if (existing) {
      throw new BadRequestException(
        'You already have an active subscription. Cancel or wait for expiry.',
      );
    }

    const planFeatures = PLAN_FEATURES[plan];
    if (!planFeatures) {
      throw new BadRequestException('Invalid subscription plan');
    }

    // Check wallet balance
    const wallet = await this.walletRepository.findOne({
      where: { user: { id: userId } },
    });

    if (!wallet || Number(wallet.balance) < planFeatures.price) {
      throw new BadRequestException(
        `Insufficient wallet balance. Required: ₹${planFeatures.price}`,
      );
    }

    // Deduct from wallet
    wallet.balance = Number(wallet.balance) - planFeatures.price;
    await this.walletRepository.save(wallet);

    // Create transaction
    const transaction = this.transactionRepository.create({
      wallet,
      type: 'subscription_charge',
      amount: -planFeatures.price,
      description: `${planFeatures.name} subscription for 30 days`,
      balanceAfter: wallet.balance,
    });
    await this.transactionRepository.save(transaction);

    // Create subscription
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + planFeatures.duration);

    const subscription = this.subscriptionRepository.create({
      provider,
      plan,
      status: SubscriptionStatus.ACTIVE,
      startDate,
      endDate,
      amountPaid: planFeatures.price,
      featuresSnapshot: planFeatures,
    });

    return this.subscriptionRepository.save(subscription);
  }

  async cancelSubscription(userId: string) {
    const provider = await this.providerRepository.findOne({
      where: { user: { id: userId } },
    });
    if (!provider) throw new NotFoundException('Provider not found');

    const subscription = await this.subscriptionRepository.findOne({
      where: {
        provider: { id: provider.id },
        status: SubscriptionStatus.ACTIVE,
      },
    });

    if (!subscription) {
      throw new NotFoundException('No active subscription found');
    }

    subscription.status = SubscriptionStatus.CANCELLED;
    subscription.cancelledAt = new Date();
    subscription.autoRenew = false;

    return this.subscriptionRepository.save(subscription);
  }

  async getSubscriptionHistory(userId: string) {
    const provider = await this.providerRepository.findOne({
      where: { user: { id: userId } },
    });
    if (!provider) throw new NotFoundException('Provider not found');

    return this.subscriptionRepository.find({
      where: { provider: { id: provider.id } },
      order: { createdAt: 'DESC' },
    });
  }

  async getProviderSubscriptionBenefits(providerId: string) {
    const subscription = await this.subscriptionRepository.findOne({
      where: {
        provider: { id: providerId },
        status: SubscriptionStatus.ACTIVE,
      },
    });

    if (!subscription) {
      return {
        hasSubscription: false,
        plan: null,
        features: null,
      };
    }

    return {
      hasSubscription: true,
      plan: subscription.plan,
      features: subscription.featuresSnapshot,
      expiresAt: subscription.endDate,
    };
  }

  async expireSubscriptions() {
    const now = new Date();
    await this.subscriptionRepository
      .createQueryBuilder()
      .update()
      .set({ status: SubscriptionStatus.EXPIRED })
      .where('status = :status', { status: SubscriptionStatus.ACTIVE })
      .andWhere('end_date < :now', { now })
      .execute();
  }
}
