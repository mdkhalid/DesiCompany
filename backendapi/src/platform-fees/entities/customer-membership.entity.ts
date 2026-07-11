import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { User } from '../../users/entities/user.entity';
import { CustomerMembershipPlan } from './customer-membership-plan.entity';

@Entity('customer_memberships')
export class CustomerMembership extends BaseEntity {
  @ManyToOne(() => User)
  @JoinColumn({ name: 'customer_id' })
  customer: User;

  @ManyToOne(() => CustomerMembershipPlan)
  @JoinColumn({ name: 'plan_id' })
  plan: CustomerMembershipPlan;

  @Column({ default: 'active' })
  status: string;

  @Column({ type: 'timestamp', name: 'start_date' })
  startDate: Date;

  @Column({ type: 'timestamp', name: 'end_date', nullable: true })
  endDate: Date;

  @Column({ type: 'timestamp', name: 'cancelled_at', nullable: true })
  cancelledAt: Date;

  @Column({ type: 'varchar', name: 'billing_cycle', default: 'monthly' })
  billingCycle: string;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    name: 'amount_paid',
    default: 0,
  })
  amountPaid: number;

  @Column({ name: 'payment_id', nullable: true })
  paymentId: string;

  @Column({ name: 'auto_renew', default: true })
  autoRenew: boolean;
}
