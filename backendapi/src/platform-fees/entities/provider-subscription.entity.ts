import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Provider } from '../../users/entities/provider.entity';
import { ProviderSubscriptionPlan } from './provider-subscription-plan.entity';

@Entity('provider_subscriptions')
export class ProviderSubscription extends BaseEntity {
  @ManyToOne(() => Provider)
  @JoinColumn({ name: 'provider_id' })
  provider: Provider;

  @ManyToOne(() => ProviderSubscriptionPlan)
  @JoinColumn({ name: 'plan_id' })
  plan: ProviderSubscriptionPlan;

  @Column({ default: 'active' })
  status: string;

  @Column({ type: 'timestamp', name: 'start_date' })
  startDate: Date;

  @Column({ type: 'timestamp', name: 'end_date', nullable: true })
  endDate: Date;

  @Column({ type: 'timestamp', name: 'cancelled_at', nullable: true })
  cancelledAt: Date;

  @Column({ type: 'decimal', precision: 10, scale: 2, name: 'amount_paid', default: 0 })
  amountPaid: number;

  @Column({ name: 'payment_id', nullable: true })
  paymentId: string;

  @Column({ name: 'auto_renew', default: true })
  autoRenew: boolean;

  @Column({ type: 'jsonb', name: 'features_snapshot', nullable: true })
  featuresSnapshot: Record<string, unknown>;
}
