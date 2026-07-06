import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  Unique,
} from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Provider } from '../../users/entities/provider.entity';
import { JobRequest } from './job-request.entity';
import { QuoteStatus } from './quote-status.enum';
import { QuoteItem } from './quote-item.entity';

@Entity('quotes')
@Unique(['jobRequest', 'provider'])
export class Quote extends BaseEntity {
  @ManyToOne(() => JobRequest, (jobRequest) => jobRequest.quotes, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'job_request_id' })
  jobRequest: JobRequest;

  @ManyToOne(() => Provider, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'provider_id' })
  provider: Provider;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({ type: 'text', nullable: true })
  message: string;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  estimatedHours: number;

  @Column({ type: 'enum', enum: QuoteStatus, default: QuoteStatus.PENDING })
  status: QuoteStatus;

  @Column({ type: 'timestamp', nullable: true })
  validUntil: Date;

  @OneToMany(() => QuoteItem, (item) => item.quote)
  items?: QuoteItem[];
}
