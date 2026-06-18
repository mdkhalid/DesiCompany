import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { TransactionSource } from '../../common/enums/transaction-source.enum';
import { Wallet } from './wallet.entity';

@Entity('transactions')
export class Transaction extends BaseEntity {
  @ManyToOne(() => Wallet, (wallet) => wallet.transactions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'wallet_id' })
  wallet: Wallet;

  @Column()
  type: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({ nullable: true })
  reference: string;

  @Column({ nullable: true })
  description: string;

  // Nullable at schema level for legacy-data migration safety.
  // The LedgerService (Phase 5) always sets source explicitly for new writes,
  // preserving the audit invariant at the service layer.
  @Column({
    type: 'enum',
    enum: TransactionSource,
    nullable: true,
    name: 'source',
  })
  source: TransactionSource | null;

  @Column({ type: 'decimal', precision: 12, scale: 2, name: 'balance_after' })
  balanceAfter: number;
}
