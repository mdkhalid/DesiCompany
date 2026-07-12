import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Account } from './account.entity';

export enum LedgerEntryType {
  DEBIT = 'debit',
  CREDIT = 'credit',
}

@Entity('ledger_entries')
@Index(['accountId', 'createdAt'])
@Index(['bookingId'])
export class LedgerEntry extends BaseEntity {
  @ManyToOne(() => Account, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'account_id' })
  account: Account;

  @Column({ name: 'account_id' })
  accountId: string;

  @Column({
    type: 'enum',
    enum: LedgerEntryType,
  })
  type: LedgerEntryType;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  @Column({ type: 'varchar' })
  currency: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  balanceAfter: number;

  @Column({ type: 'varchar', nullable: true })
  reference: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ nullable: true })
  bookingId: string;

  @Column({ nullable: true })
  paymentId: string;

  @Column({ nullable: true })
  providerId: string;

  @Column({ nullable: true })
  customerId: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;
}
