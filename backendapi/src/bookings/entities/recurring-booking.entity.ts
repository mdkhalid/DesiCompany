import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Customer } from '../../users/entities/customer.entity';
import { Provider } from '../../users/entities/provider.entity';
import { ProviderService } from '../../services/entities/provider-service.entity';

export enum RecurrenceFrequency {
  WEEKLY = 'weekly',
  BI_WEEKLY = 'bi_weekly',
  MONTHLY = 'monthly',
}

export enum RecurrenceStatus {
  ACTIVE = 'active',
  PAUSED = 'paused',
  CANCELLED = 'cancelled',
}

@Entity('recurring_bookings')
export class RecurringBooking extends BaseEntity {
  @ManyToOne(() => Customer, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;

  @ManyToOne(() => Provider, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'provider_id' })
  provider: Provider;

  @ManyToOne(() => ProviderService, { nullable: true })
  @JoinColumn({ name: 'provider_service_id' })
  providerService: ProviderService;

  @Column({ name: 'frequency', type: 'enum', enum: RecurrenceFrequency })
  frequency: RecurrenceFrequency;

  @Column({ name: 'day_of_week', type: 'int', nullable: true })
  dayOfWeek: number | null;

  @Column({ name: 'day_of_month', type: 'int', nullable: true })
  dayOfMonth: number | null;

  @Column({
    name: 'preferred_time',
    type: 'varchar',
    length: 5,
    nullable: true,
  })
  preferredTime: string | null;

  @Column({ name: 'description', type: 'text', nullable: true })
  description: string | null;

  @Column({
    name: 'status',
    type: 'enum',
    enum: RecurrenceStatus,
    default: RecurrenceStatus.ACTIVE,
  })
  status: RecurrenceStatus;

  @Column({ name: 'next_occurrence_date', type: 'date' })
  nextOccurrenceDate: string;

  @Column({ name: 'last_occurrence_date', type: 'date', nullable: true })
  lastOccurrenceDate: string | null;
}
