import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Wallet } from './entities/wallet.entity';
import { Transaction } from './entities/transaction.entity';
import { Provider } from '../users/entities/provider.entity';
import { TransactionSource } from '../common/enums/transaction-source.enum';

export interface SoftBlockConfig {
  thresholdMultiplier: number;
  lookbackDays: number;
}

@Injectable()
export class SoftBlockService {
  private readonly logger = new Logger(SoftBlockService.name);

  private config: SoftBlockConfig = {
    thresholdMultiplier: 2,
    lookbackDays: 30,
  };

  constructor(
    @InjectRepository(Wallet)
    private readonly walletRepository: Repository<Wallet>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @InjectRepository(Provider)
    private readonly providerRepository: Repository<Provider>,
  ) {}

  getConfig(): SoftBlockConfig {
    return { ...this.config };
  }

  updateConfig(partial: Partial<SoftBlockConfig>) {
    if (partial.thresholdMultiplier !== undefined) {
      this.config.thresholdMultiplier = partial.thresholdMultiplier;
    }
    if (partial.lookbackDays !== undefined) {
      this.config.lookbackDays = partial.lookbackDays;
    }
    return { ...this.config };
  }

  async checkAndBlockProviders(): Promise<{ blocked: number }> {
    const wallets = await this.walletRepository
      .createQueryBuilder('wallet')
      .innerJoinAndSelect('wallet.user', 'user')
      .innerJoin('providers', 'provider', 'provider.user_id = user.id')
      .where('provider.is_soft_blocked = false')
      .andWhere('provider.is_active = true')
      .getMany();

    let blockedCount = 0;

    for (const wallet of wallets) {
      const shouldBlock = await this.shouldSoftBlock(wallet);
      if (shouldBlock) {
        await this.providerRepository.update(
          { user: { id: wallet.user.id } },
          { isSoftBlocked: true },
        );
        blockedCount++;
        this.logger.warn(
          `Provider user ${wallet.user.id} soft-blocked due to outstanding commissions`,
        );
      }
    }

    return { blocked: blockedCount };
  }

  async shouldSoftBlock(wallet: Wallet): Promise<boolean> {
    const lookbackDate = new Date();
    lookbackDate.setDate(lookbackDate.getDate() - this.config.lookbackDays);

    const recentCommissionTx = await this.transactionRepository
      .createQueryBuilder('tx')
      .where('tx.wallet_id = :walletId', { walletId: wallet.id })
      .andWhere('tx.source = :source', {
        source: TransactionSource.COMMISSION_OWED,
      })
      .andWhere('tx.created_at >= :lookbackDate', { lookbackDate })
      .andWhere('tx.type = :type', { type: 'debit' })
      .getMany();

    if (recentCommissionTx.length === 0) return false;

    const totalCommissionOwed = recentCommissionTx.reduce(
      (sum, tx) => sum + Number(tx.amount),
      0,
    );
    const avgCommission =
      recentCommissionTx.length > 0
        ? totalCommissionOwed / recentCommissionTx.length
        : 0;

    const threshold = avgCommission * this.config.thresholdMultiplier;

    return totalCommissionOwed >= threshold;
  }

  async checkAndBlockForProvider(userId: string): Promise<void> {
    const wallet = await this.walletRepository.findOne({
      where: { user: { id: userId } },
    });
    if (!wallet) return;

    const provider = await this.providerRepository.findOne({
      where: { user: { id: userId } },
    });
    if (!provider || provider.isSoftBlocked) return;

    const shouldBlock = await this.shouldSoftBlock(wallet);
    if (shouldBlock) {
      provider.isSoftBlocked = true;
      await this.providerRepository.save(provider);
      this.logger.warn(
        `Provider user ${userId} soft-blocked due to outstanding commissions`,
      );
    }
  }

  async unblockProvider(userId: string): Promise<void> {
    const provider = await this.providerRepository.findOne({
      where: { user: { id: userId } },
    });
    if (!provider) return;

    if (!provider.isSoftBlocked) return;

    provider.isSoftBlocked = false;
    await this.providerRepository.save(provider);
    this.logger.log(`Provider user ${userId} unblocked`);
  }

  async checkAndUnblockProvider(userId: string): Promise<void> {
    const wallet = await this.walletRepository.findOne({
      where: { user: { id: userId } },
    });
    if (!wallet) return;

    const provider = await this.providerRepository.findOne({
      where: { user: { id: userId } },
    });
    if (!provider || !provider.isSoftBlocked) return;

    const outstanding = await this.transactionRepository
      .createQueryBuilder('tx')
      .where('tx.wallet_id = :walletId', { walletId: wallet.id })
      .andWhere('tx.source = :source', {
        source: TransactionSource.COMMISSION_OWED,
      })
      .andWhere('tx.type = :type', { type: 'debit' })
      .getMany();

    const totalOwed = outstanding.reduce(
      (sum, tx) => sum + Number(tx.amount),
      0,
    );

    if (totalOwed <= 0) {
      provider.isSoftBlocked = false;
      await this.providerRepository.save(provider);
      this.logger.log(
        `Provider user ${userId} auto-unblocked — all commissions settled`,
      );
    }
  }
}
