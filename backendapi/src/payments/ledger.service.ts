import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Wallet } from './entities/wallet.entity';
import { Transaction } from './entities/transaction.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { TransactionSource } from '../common/enums/transaction-source.enum';
import { PaymentStatus } from '../common/enums/payment-status.enum';

@Injectable()
export class LedgerService {
  private readonly logger = new Logger(LedgerService.name);

  constructor(
    @InjectRepository(Wallet)
    private readonly walletRepository: Repository<Wallet>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @InjectRepository(Booking)
    private readonly bookingRepository: Repository<Booking>,
    private readonly dataSource: DataSource,
  ) {}

  async settleOutstandingCommissions(providerUserId?: string) {
    const walletQuery = this.walletRepository
      .createQueryBuilder('wallet')
      .innerJoinAndSelect('wallet.user', 'user');

    if (providerUserId) {
      walletQuery.where('user.id = :userId', { userId: providerUserId });
    }

    const wallets = await walletQuery.getMany();

    for (const wallet of wallets) {
      await this.settleWallet(wallet);
    }

    return { settledWallets: wallets.length };
  }

  private async settleWallet(wallet: Wallet) {
    const outstandingCommission = await this.transactionRepository
      .createQueryBuilder('tx')
      .where('tx.wallet_id = :walletId', { walletId: wallet.id })
      .andWhere('tx.source = :source', { source: TransactionSource.COMMISSION_OWED })
      .andWhere('tx.type = :type', { type: 'debit' })
      .getMany();

    const totalOwed = outstandingCommission.reduce(
      (sum, tx) => sum + Number(tx.amount),
      0,
    );

    if (totalOwed <= 0) return;

    const walletBalance = Number(wallet.balance);
    const settlementAmount = Math.min(totalOwed, walletBalance);

    if (settlementAmount <= 0) return;

    await this.dataSource.transaction(async (manager) => {
      wallet.balance = walletBalance - settlementAmount;
      await manager.save(Wallet, wallet);

      const settlementTx = manager.create(Transaction, {
        wallet,
        type: 'debit',
        amount: settlementAmount,
        reference: `commission_settlement_${wallet.id}_${Date.now()}`,
        description: `Commission settlement: ${settlementAmount} deducted`,
        source: TransactionSource.SETTLEMENT,
        balanceAfter: Number(wallet.balance),
      });
      await manager.save(Transaction, settlementTx);
    });

    this.logger.log(
      `Settled ${settlementAmount} from wallet ${wallet.id}, remaining owed: ${totalOwed - settlementAmount}`,
    );
  }
}
