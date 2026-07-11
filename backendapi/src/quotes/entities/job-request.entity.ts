import { Column, Entity, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Customer } from '../../users/entities/customer.entity';
import { ServiceCategory } from '../../services/entities/service-category.entity';
import { JobRequestStatus } from './job-request-status.enum';
import { Quote } from './quote.entity';

@Entity('job_requests')
export class JobRequest extends BaseEntity {
  @ManyToOne(() => Customer, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;

  @ManyToOne(() => ServiceCategory, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'category_id' })
  category: ServiceCategory;

  @Column()
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ nullable: true })
  address: string;

  @Column({ nullable: true })
  locality: string;

  @Column({ nullable: true })
  city: string;

  @Column({ type: 'decimal', precision: 10, scale: 6, nullable: true })
  latitude: number;

  @Column({ type: 'decimal', precision: 10, scale: 6, nullable: true })
  longitude: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  budgetMin: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  budgetMax: number;

  @Column({ type: 'timestamp', nullable: true })
  preferredDate: Date;

  @Column({
    type: 'enum',
    enum: JobRequestStatus,
    default: JobRequestStatus.OPEN,
  })
  status: JobRequestStatus;

  @Column({ name: 'accepted_quote_id', type: 'uuid', nullable: true })
  acceptedQuoteId: string;

  @OneToMany(() => Quote, (quote) => quote.jobRequest)
  quotes?: Quote[];
}
