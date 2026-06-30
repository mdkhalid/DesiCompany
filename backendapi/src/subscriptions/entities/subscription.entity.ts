import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Provider } from '../../users/entities/provider.entity';

export enum SubscriptionPlan {
  BASIC = 'basic',
  PRO = 'pro',
  PREMIUM = 'premium',
}

export enum SubscriptionStatus {
  ACTIVE = 'active',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled',
  PAUSED = 'paused',
}

export const PLAN_FEATURES: Record<SubscriptionPlan, {
  name: string;
  price: number;
  duration: number;
  commissionDiscount: number;
  priorityBoost: number;
  featuredBadge: boolean;
  analyticsAccess: boolean;
  supportPriority: string;
  maxServices: number;
}> = {
  [SubscriptionPlan.BASIC]: {
    name: 'Basic',
    price: 499,
    duration: 30,
    commissionDiscount: 2,
    priorityBoost: 10,
    featuredBadge: false,
    analyticsAccess: false,
    supportPriority: 'normal',
    maxServices: 10,
  },
  [SubscriptionPlan.PRO]: {
    name: 'Pro',
    price: 999,
    duration: 30,
    commissionDiscount: 5,
    priorityBoost: 25,
    featuredBadge: true,
    analyticsAccess: true,
    supportPriority: 'priority',
    maxServices: 25,
  },
  [SubscriptionPlan.PREMIUM]: {
    name: 'Premium',
    price: 1999,
    duration: 30,
    commissionDiscount: 10,
    priorityBoost: 50,
    featuredBadge: true,
    analyticsAccess: true,
    supportPriority: 'vip',
    maxServices: 50,
  },
};

@Entity('subscriptions')
export class Subscription extends BaseEntity {
  @ManyToOne(() => Provider, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'provider_id' })
  provider: Provider;

  @Column({
    type: 'enum',
    enum: SubscriptionPlan,
  })
  plan: SubscriptionPlan;

  @Column({
    type: 'enum',
    enum: SubscriptionStatus,
    default: SubscriptionStatus.ACTIVE,
  })
  status: SubscriptionStatus;

  @Column({ name: 'start_date', type: 'timestamp' })
  startDate: Date;

  @Column({ name: 'end_date', type: 'timestamp' })
  endDate: Date;

  @Column({ name: 'amount_paid', type: 'decimal', precision: 10, scale: 2 })
  amountPaid: number;

  @Column({ name: 'payment_id', nullable: true })
  paymentId: string;

  @Column({ name: 'auto_renew', default: true })
  autoRenew: boolean;

  @Column({ name: 'cancelled_at', type: 'timestamp', nullable: true })
  cancelledAt: Date;

  @Column({ name: 'features_snapshot', type: 'jsonb', nullable: true })
  featuresSnapshot: Record<string, any>;
}
