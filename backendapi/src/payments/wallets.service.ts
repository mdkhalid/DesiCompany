import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Wallet } from './entities/wallet.entity';
import { Transaction } from './entities/transaction.entity';
import { User } from '../users/entities/user.entity';
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
        user: { id: userId } as any,
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

  async getTransactions(
    userId: string,
    page = 1,
    limit = 20,
  ) {
    const wallet = await this.walletRepository.findOne({
      where: { user: { id: userId } },
    });
    if (!wallet) {
      return { transactions: [], total: 0, page, limit };
    }

    const [transactions, total] = await this.transactionRepository.findAndCount({
      where: { wallet: { id: wallet.id } },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

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
}
