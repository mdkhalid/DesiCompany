import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

@Entity('provider_subscription_plans')
export class ProviderSubscriptionPlan extends BaseEntity {
  @Column()
  name: string;

  @Column({ nullable: true })
  description: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, name: 'monthly_price' })
  monthlyPrice: number;

  @Column({ type: 'jsonb', nullable: true })
  benefits: Record<string, unknown>;

  @Column({ default: true, name: 'is_active' })
  isActive: boolean;
}
