import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { User } from '../../users/entities/user.entity';

export enum LoyaltyTier {
  BRONZE = 'bronze',
  SILVER = 'silver',
  GOLD = 'gold',
  PLATINUM = 'platinum',
}

@Entity('loyalty_points')
export class LoyaltyPoint extends BaseEntity {
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  points: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  totalEarned: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  totalRedeemed: number;

  @Column({ type: 'enum', enum: LoyaltyTier, default: LoyaltyTier.BRONZE })
  tier: LoyaltyTier;

  @Column({ default: 0 })
  bookingsCount: number;
}