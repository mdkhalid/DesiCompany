import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Wallet } from './entities/wallet.entity';
import { Transaction } from './entities/transaction.entity';
import { User } from '../users/entities/user.entity';
import { PlatformFeesService } from '../platform-fees/platform-fees.service';
import { TransactionSource } from '../common/enums/transaction-source.enum';

@Injectable()
export class WalletsService {
  constructor(
    @InjectRepository(Wallet)
    private readonly walletRepository: Repository<Wallet>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly platformFeesService: PlatformFeesService,
  ) {}

  async getWallet(userId: string) {
    let wallet = await this.walletRepository.findOne({
      where: { user: { id: userId } },
    });
    if (!wallet) {
      const user = await this.userRepository.findOne({ where: { id: userId } });
      if (!user) {
        throw new NotFoundException('User not found');
      }
      wallet = this.walletRepository.create({
        user: { id: userId },
        balance: 0,
      });
      wallet = await this.walletRepository.save(wallet);
    }
    return {
      id: wallet.id,
      balance: Number(wallet.balance),
      userId,
    };
  }

  async getTransactions(userId: string, page = 1, limit = 20) {
    const wallet = await this.walletRepository.findOne({
      where: { user: { id: userId } },
    });
    if (!wallet) {
      return { transactions: [], total: 0, page, limit };
    }

    const [transactions, total] = await this.transactionRepository.findAndCount(
      {
        where: { wallet: { id: wallet.id } },
        order: { createdAt: 'DESC' },
        skip: (page - 1) * limit,
        take: limit,
      },
    );

    return {
      transactions: transactions.map((tx) => ({
        id: tx.id,
        type: tx.type,
        amount: Number(tx.amount),
        reference: tx.reference,
        description: tx.description,
        source: tx.source,
        balanceAfter: Number(tx.balanceAfter),
        createdAt: tx.createdAt,
      })),
      total,
      page,
      limit,
    };
  }

  async requestInstantPayout(
    userId: string,
    payoutAmount?: number,
  ): Promise<{
    payoutAmount: number;
    fee: number;
    netAmount: number;
    remainingBalance: number;
  }> {
    const wallet = await this.walletRepository.findOne({
      where: { user: { id: userId } },
    });
    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    const currentBalance = Number(wallet.balance);
    const amount = payoutAmount ?? currentBalance;

    if (amount <= 0) {
      throw new BadRequestException('Payout amount must be greater than 0');
    }

    // Calculate instant payout fee
    const feeResult =
      await this.platformFeesService.calculateInstantPayoutFee(amount);
    const totalDeduction = amount + feeResult.finalFee;

    if (totalDeduction > currentBalance) {
      throw new BadRequestException(
        `Insufficient balance. Need ₹${totalDeduction.toLocaleString()} (₹${amount.toLocaleString()} payout + ₹${feeResult.finalFee.toLocaleString()} fee). Available: ₹${currentBalance.toLocaleString()}`,
      );
    }

    const netAmount = feeResult.netAmount;

    // Deduct total (payout amount + fee) from wallet
    wallet.balance = Number(wallet.balance) - totalDeduction;
    await this.walletRepository.save(wallet);
    const balanceAfter = Number(wallet.balance);

    // Record payout debit
    const payoutTx = this.transactionRepository.create({
      wallet,
      type: 'debit',
      amount: amount,
      reference: `instant_payout_${Date.now()}`,
      description: 'Instant payout',
      source: TransactionSource.PAYOUT,
      balanceAfter,
    });
    await this.transactionRepository.save(payoutTx);

    // Record platform fee
    if (feeResult.finalFee > 0) {
      const feeTx = this.transactionRepository.create({
        wallet,
        type: 'debit',
        amount: feeResult.finalFee,
        reference: `payout_fee_${Date.now()}`,
        description: 'Instant payout fee',
        source: TransactionSource.PLATFORM_FEE,
        balanceAfter,
      });
      await this.transactionRepository.save(feeTx);
    }

    return {
      payoutAmount: amount,
      fee: feeResult.finalFee,
      netAmount,
      remainingBalance: Number(wallet.balance),
    };
  }
}
