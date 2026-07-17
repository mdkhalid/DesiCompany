import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

@Entity('provider_subscription_plans')
export class ProviderSubscriptionPlan extends BaseEntity {
  @Column({ unique: true })
  name: string;

  @Column({ nullable: true })
  description: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: number;

  @Column({ default: 1, name: 'duration_months' })
  durationMonths: number;

  @Column({ default: 0, name: 'extra_days' })
  extraDays: number;

  @Column({ type: 'jsonb', nullable: true })
  benefits: Record<string, unknown>;

  @Column({ default: true, name: 'is_active' })
  isActive: boolean;
}
