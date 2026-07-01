import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LoyaltyPoint, LoyaltyTier } from './entities/loyalty-point.entity';
import { Wallet } from '../payments/entities/wallet.entity';
import { Transaction } from '../payments/entities/transaction.entity';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../common/enums/user-role.enum';

@Injectable()
export class LoyaltyService {
  constructor(
    @InjectRepository(LoyaltyPoint)
    private readonly loyaltyRepository: Repository<LoyaltyPoint>,
    @InjectRepository(Wallet)
    private readonly walletRepository: Repository<Wallet>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async getOrCreateLoyalty(userId: string): Promise<LoyaltyPoint> {
    let loyalty = await this.loyaltyRepository.findOne({
      where: { user: { id: userId } },
    });
    if (!loyalty) {
      loyalty = this.loyaltyRepository.create({
        user: { id: userId } as User,
        points: 0,
        totalEarned: 0,
        totalRedeemed: 0,
        tier: LoyaltyTier.BRONZE,
        bookingsCount: 0,
      });
      await this.loyaltyRepository.save(loyalty);
    }
    return loyalty;
  }

  async awardPointsForBooking(
    userId: string,
    bookingAmount: number,
  ): Promise<{ pointsEarned: number; tier: LoyaltyTier }> {
    const loyalty = await this.getOrCreateLoyalty(userId);
    const pointsEarned = Math.floor(bookingAmount * 0.1);

    loyalty.points = Number(loyalty.points) + pointsEarned;
    loyalty.totalEarned = Number(loyalty.totalEarned) + pointsEarned;
    loyalty.bookingsCount = loyalty.bookingsCount + 1;
    loyalty.tier = this.calculateTier(loyalty.totalEarned);

    await this.loyaltyRepository.save(loyalty);
    return { pointsEarned, tier: loyalty.tier };
  }

  async redeemPoints(
    userId: string,
    points: number,
  ): Promise<{
    redeemed: number;
    walletCredit: number;
    remainingPoints: number;
  }> {
    const loyalty = await this.getOrCreateLoyalty(userId);

    if (points <= 0) {
      throw new BadRequestException('Points must be positive');
    }

    if (Number(loyalty.points) < points) {
      throw new BadRequestException('Insufficient points');
    }

    const minRedeem = 100;
    if (points < minRedeem) {
      throw new BadRequestException(
        `Minimum redemption is ${minRedeem} points`,
      );
    }

    const walletCredit = points / 10;

    loyalty.points = Number(loyalty.points) - points;
    loyalty.totalRedeemed = Number(loyalty.totalRedeemed) + points;
    await this.loyaltyRepository.save(loyalty);

    let wallet = await this.walletRepository.findOne({
      where: { user: { id: userId } },
    });
    if (!wallet) {
      wallet = this.walletRepository.create({
        user: { id: userId } as User,
        balance: 0,
      });
      wallet = await this.walletRepository.save(wallet);
    }
    wallet.balance = Number(wallet.balance) + walletCredit;
    await this.walletRepository.save(wallet);

    const transaction = this.transactionRepository.create({
      wallet,
      type: 'loyalty_redemption',
      amount: walletCredit,
      description: `Redeemed ${points} loyalty points`,
      balanceAfter: wallet.balance,
    });
    await this.transactionRepository.save(transaction);

    return { redeemed: points, walletCredit, remainingPoints: loyalty.points };
  }

  async getLeaderboard(limit = 10): Promise<LoyaltyPoint[]> {
    return this.loyaltyRepository.find({
      relations: { user: true },
      order: { points: 'DESC' },
      take: limit,
    });
  }

  async getAllLoyaltyUsers(role?: UserRole): Promise<LoyaltyPoint[]> {
    const where: { user?: { role?: UserRole } } = {};
    if (role) {
      where.user = { role };
    }
    return this.loyaltyRepository.find({
      where,
      relations: { user: true },
      order: { points: 'DESC' },
    });
  }

  private calculateTier(totalEarned: number): LoyaltyTier {
    if (totalEarned >= 10000) return LoyaltyTier.PLATINUM;
    if (totalEarned >= 5000) return LoyaltyTier.GOLD;
    if (totalEarned >= 1000) return LoyaltyTier.SILVER;
    return LoyaltyTier.BRONZE;
  }
}
