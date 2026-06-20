import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

@Entity('customer_membership_plans')
export class CustomerMembershipPlan extends BaseEntity {
  @Column()
  name: string;

  @Column({ nullable: true })
  description: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, name: 'monthly_price' })
  monthlyPrice: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    name: 'yearly_price',
    default: 0,
  })
  yearlyPrice: number;

  @Column({ type: 'jsonb', nullable: true })
  benefits: Record<string, any>;

  @Column({ default: true, name: 'is_active' })
  isActive: boolean;
}
