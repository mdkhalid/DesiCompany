import { Column, Entity, Index, OneToMany } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { LedgerEntry } from './ledger-entry.entity';

export enum AccountType {
  ASSET = 'asset',
  LIABILITY = 'liability',
  EQUITY = 'equity',
  REVENUE = 'revenue',
  EXPENSE = 'expense',
}

export enum AccountCategory {
  PLATFORM_REVENUE = 'platform_revenue',
  COMMISSION = 'commission',
  SUBSCRIPTION_REVENUE = 'subscription_revenue',
  MEMBERSHIP_REVENUE = 'membership_revenue',
  PAYOUT = 'payout',
  REFUND = 'refund',
  CASH = 'cash',
  ONLINE = 'online',
  TAX = 'tax',
}

@Entity('accounts')
@Index(['code'], { unique: true })
@Index(['isActive'])
export class Account extends BaseEntity {
  @Column({ unique: true })
  code: string;

  @Column()
  name: string;

  @Column({
    type: 'enum',
    enum: AccountType,
  })
  type: AccountType;

  @Column({
    type: 'enum',
    enum: AccountCategory,
    nullable: true,
  })
  category?: AccountCategory;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  balance: number;

  @Column({ type: 'text', nullable: true })
  description: string;

  @OneToMany(() => LedgerEntry, (entry) => entry.account)
  entries?: LedgerEntry[];
}
