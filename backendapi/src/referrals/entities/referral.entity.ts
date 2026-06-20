import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { User } from '../../users/entities/user.entity';

@Entity('referrals')
export class Referral extends BaseEntity {
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'referrer_id' })
  referrer: User;

  @Column({ name: 'referral_code', type: 'varchar', length: 8, unique: true })
  referralCode: string;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'referred_user_id' })
  referredUser: User | null;

  @Column({ name: 'referred_user_id', type: 'uuid', nullable: true })
  referredUserId: string | null;

  @Column({ name: 'is_used', default: false })
  isUsed: boolean;

  @Column({
    name: 'referrer_credit_amount',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 50,
  })
  referrerCreditAmount: number;

  @Column({
    name: 'referred_credit_amount',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 50,
  })
  referredCreditAmount: number;

  @Column({ name: 'credited_at', type: 'timestamp', nullable: true })
  creditedAt: Date | null;
}
