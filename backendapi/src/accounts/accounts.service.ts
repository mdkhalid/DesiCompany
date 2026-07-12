import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Account } from './entities/account.entity';
import { LedgerEntry, LedgerEntryType } from './entities/ledger-entry.entity';
import { AccountType, AccountCategory } from './entities/account.entity';

@Injectable()
export class AccountsService {
  private readonly logger = new Logger(AccountsService.name);

  constructor(
    @InjectRepository(Account)
    private readonly accountRepository: Repository<Account>,
    @InjectRepository(LedgerEntry)
    private readonly ledgerRepository: Repository<LedgerEntry>,
    private readonly dataSource: DataSource,
  ) {}

  async ensureDefaults() {
    const defaults: Partial<Account>[] = [
      {
        code: 'platform-revenue',
        name: 'Platform Revenue',
        type: AccountType.REVENUE,
        category: AccountCategory.PLATFORM_REVENUE,
      },
      {
        code: 'commission',
        name: 'Commission Receivable',
        type: AccountType.ASSET,
        category: AccountCategory.COMMISSION,
      },
      {
        code: 'subscription-revenue',
        name: 'Subscription Revenue',
        type: AccountType.REVENUE,
        category: AccountCategory.SUBSCRIPTION_REVENUE,
      },
      {
        code: 'membership-revenue',
        name: 'Membership Revenue',
        type: AccountType.REVENUE,
        category: AccountCategory.MEMBERSHIP_REVENUE,
      },
      {
        code: 'payout',
        name: 'Provider Payouts',
        type: AccountType.EXPENSE,
        category: AccountCategory.PAYOUT,
      },
      {
        code: 'refund',
        name: 'Refunds',
        type: AccountType.EXPENSE,
        category: AccountCategory.REFUND,
      },
      {
        code: 'cash-on-hand',
        name: 'Cash On Hand',
        type: AccountType.ASSET,
        category: AccountCategory.CASH,
      },
      {
        code: 'razorpay',
        name: 'Razorpay Gateway',
        type: AccountType.ASSET,
        category: AccountCategory.ONLINE,
      },
      {
        code: 'stripe',
        name: 'Stripe Gateway',
        type: AccountType.ASSET,
        category: AccountCategory.ONLINE,
      },
      {
        code: 'gst',
        name: 'GST Payable',
        type: AccountType.LIABILITY,
        category: AccountCategory.TAX,
      },
    ];

    for (const d of defaults) {
      const exists = await this.accountRepository.findOne({
        where: { code: d.code! },
      });
      if (!exists) {
        const account = this.accountRepository.create(d);
        await this.accountRepository.save(account);
        this.logger.log(`Account created: ${d.code}`);
      }
    }
  }

  async findAll() {
    return this.accountRepository.find({ order: { code: 'ASC' } });
  }

  async findOne(id: string) {
    const account = await this.accountRepository.findOne({ where: { id } });
    if (!account) {
      throw new NotFoundException('Account not found');
    }
    return account;
  }

  postEntry(dto: {
    accountCode: string;
    type: LedgerEntryType;
    amount: number;
    currency?: string;
    reference?: string;
    description?: string;
    bookingId?: string;
    paymentId?: string;
    providerId?: string;
    customerId?: string;
    metadata?: Record<string, any>;
  }) {
    return this.dataSource.transaction(async (manager) => {
      const account = (await manager.findOne(Account, {
        where: { code: dto.accountCode },
      })) as Account;

      if (!account) {
        throw new NotFoundException(`Account not found: ${dto.accountCode}`);
      }

      const amount = Number(dto.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error('Ledger amount must be a positive number');
      }

      const balanceBefore = Number(account.balance);
      const balanceAfter =
        dto.type === LedgerEntryType.CREDIT
          ? balanceBefore + amount
          : balanceBefore - amount;

      const entry = manager.create(LedgerEntry, {
        account,
        accountId: account.id,
        type: dto.type,
        amount,
        currency: dto.currency || 'INR',
        balanceAfter,
        reference: dto.reference,
        description: dto.description,
        bookingId: dto.bookingId,
        paymentId: dto.paymentId,
        providerId: dto.providerId,
        customerId: dto.customerId,
        metadata: dto.metadata,
      } as any);

      account.balance = balanceAfter;
      await manager.save(Account, account);
      await manager.save(LedgerEntry, entry);

      return { entry, account };
    });
  }
}
