import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import {
  PromotedListing,
  PromotedListingStatus,
} from './entities/promoted-listing.entity';
import { Provider } from '../users/entities/provider.entity';
import { ServiceCategory } from '../services/entities/service-category.entity';
import { Wallet } from '../payments/entities/wallet.entity';
import { Transaction } from '../payments/entities/transaction.entity';
import { User } from '../users/entities/user.entity';

@Injectable()
export class PromotionsService {
  constructor(
    @InjectRepository(PromotedListing)
    private readonly promotedRepository: Repository<PromotedListing>,
    @InjectRepository(Provider)
    private readonly providerRepository: Repository<Provider>,
    @InjectRepository(ServiceCategory)
    private readonly categoryRepository: Repository<ServiceCategory>,
    @InjectRepository(Wallet)
    private readonly walletRepository: Repository<Wallet>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
  ) {}

  async createPromotion(
    userId: string,
    categoryId: string | null,
    bidAmount: number,
    days: number,
  ) {
    const provider = await this.providerRepository.findOne({
      where: { user: { id: userId } },
    });
    if (!provider) throw new NotFoundException('Provider not found');

    if (bidAmount < 50) {
      throw new BadRequestException('Minimum bid amount is Rs. 50');
    }

    const dailyRate = bidAmount;
    const totalCost = dailyRate * days;

    let category: ServiceCategory | null = null;
    if (categoryId) {
      category = await this.categoryRepository.findOne({
        where: { id: categoryId },
      });
    }

    // Deduct from wallet
    const wallet = await this.walletRepository.findOne({
      where: { user: { id: userId } },
    });
    if (!wallet || Number(wallet.balance) < totalCost) {
      throw new BadRequestException('Insufficient wallet balance');
    }

    wallet.balance = Number(wallet.balance) - totalCost;
    await this.walletRepository.save(wallet);

    const transaction = this.transactionRepository.create({
      wallet,
      type: 'promotion_charge',
      amount: -totalCost,
      description: `Promoted listing: ${days} days`,
      balanceAfter: wallet.balance,
    });
    await this.transactionRepository.save(transaction);

    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + days);

    const promotion = this.promotedRepository.create({
      provider,
      category,
      bidAmount: dailyRate,
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      priority: Math.floor(dailyRate),
      status: PromotedListingStatus.ACTIVE,
    });
    return this.promotedRepository.save(promotion);
  }

  async getActivePromotions(categoryId?: string) {
    const today = new Date().toISOString().split('T')[0];
    const query = this.promotedRepository
      .createQueryBuilder('promotion')
      .leftJoinAndSelect('promotion.provider', 'provider')
      .leftJoinAndSelect('promotion.category', 'category')
      .where('promotion.status = :status', {
        status: PromotedListingStatus.ACTIVE,
      })
      .andWhere('promotion.start_date <= :today', { today })
      .andWhere('promotion.end_date >= :today', { today });

    if (categoryId) {
      query.andWhere('promotion.category_id = :categoryId', { categoryId });
    }

    return query
      .orderBy('promotion.priority', 'DESC')
      .addOrderBy('promotion.bidAmount', 'DESC')
      .getMany();
  }

  async getProviderPromotions(providerId: string) {
    return this.promotedRepository.find({
      where: { provider: { id: providerId } },
      order: { createdAt: 'DESC' },
    });
  }

  async recordClick(promotionId: string) {
    await this.promotedRepository.increment({ id: promotionId }, 'clicks', 1);
  }

  async recordImpression(promotionId: string) {
    await this.promotedRepository.increment(
      { id: promotionId },
      'impressions',
      1,
    );
  }

  async expireOldPromotions() {
    const today = new Date().toISOString().split('T')[0];
    await this.promotedRepository
      .createQueryBuilder()
      .update()
      .set({ status: PromotedListingStatus.EXPIRED })
      .where('end_date < :today', { today })
      .andWhere('status = :status', { status: PromotedListingStatus.ACTIVE })
      .execute();
  }
}
