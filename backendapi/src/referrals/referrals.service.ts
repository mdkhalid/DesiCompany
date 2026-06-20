import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Referral } from './entities/referral.entity';
import { User } from '../users/entities/user.entity';
import { Wallet } from '../payments/entities/wallet.entity';
import { Transaction } from '../payments/entities/transaction.entity';

@Injectable()
export class ReferralsService {
  constructor(
    @InjectRepository(Referral)
    private readonly referralRepository: Repository<Referral>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Wallet)
    private readonly walletRepository: Repository<Wallet>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
  ) {}

  private generateReferralCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  async getOrCreateReferralCode(userId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    let referral = await this.referralRepository.findOne({
      where: { referrer: { id: userId } },
    });

    if (!referral) {
      const code = this.generateReferralCode();
      referral = this.referralRepository.create({
        referrer: user,
        referralCode: code,
        referrerCreditAmount: 50,
        referredCreditAmount: 50,
      });
      await this.referralRepository.save(referral);
    }

    return {
      referralCode: referral.referralCode,
      referrerCreditAmount: referral.referrerCreditAmount,
      referredCreditAmount: referral.referredCreditAmount,
      totalReferrals: await this.countReferrals(userId),
    };
  }

  async applyReferralCode(referredUserId: string, referralCode: string) {
    const referredUser = await this.userRepository.findOne({
      where: { id: referredUserId },
    });
    if (!referredUser) {
      throw new NotFoundException('User not found');
    }

    const referral = await this.referralRepository.findOne({
      where: { referralCode },
      relations: { referrer: true },
    });
    if (!referral) {
      throw new NotFoundException('Invalid referral code');
    }

    if (referral.referrer.id === referredUserId) {
      throw new BadRequestException('Cannot use your own referral code');
    }

    if (referral.isUsed) {
      throw new ConflictException('This referral code has already been used');
    }

    referral.referredUser = referredUser;
    referral.referredUserId = referredUserId;
    referral.isUsed = true;
    referral.creditedAt = new Date();
    await this.referralRepository.save(referral);

    await this.creditWallet(
      referral.referrer.id,
      referral.referrerCreditAmount,
      `Referral bonus: referred ${referredUser.email || referredUser.phone}`,
    );

    await this.creditWallet(
      referredUserId,
      referral.referredCreditAmount,
      `Referral bonus: joined via ${referral.referralCode}`,
    );

    return {
      message: 'Referral applied successfully',
      credited: referral.referredCreditAmount,
    };
  }

  async getReferralStats(userId: string) {
    const referral = await this.referralRepository.findOne({
      where: { referrer: { id: userId } },
    });

    if (!referral) {
      return {
        referralCode: null,
        totalReferrals: 0,
        totalCreditsEarned: 0,
      };
    }

    const totalCredits = await this.referralRepository
      .createQueryBuilder('referral')
      .where('referral.referrer_id = :userId', { userId })
      .andWhere('referral.is_used = :isUsed', { isUsed: true })
      .select('SUM(referral.referrer_credit_amount)', 'total')
      .getRawOne();

    return {
      referralCode: referral.referralCode,
      totalReferrals: await this.countReferrals(userId),
      totalCreditsEarned: Number(totalCredits?.total || 0),
    };
  }

  private async countReferrals(userId: string): Promise<number> {
    return this.referralRepository.count({
      where: { referrer: { id: userId }, isUsed: true },
    });
  }

  private async creditWallet(userId: string, amount: number, description: string) {
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

    wallet.balance = Number(wallet.balance) + amount;
    await this.walletRepository.save(wallet);

    const transaction = this.transactionRepository.create({
      wallet,
      type: 'referral_bonus',
      amount,
      description,
      balanceAfter: wallet.balance,
    });
    await this.transactionRepository.save(transaction);
  }
}
