import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Provider } from '../../users/entities/provider.entity';
import { ServiceCategory } from '../../services/entities/service-category.entity';

export enum PromotedListingStatus {
  ACTIVE = 'active',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled',
}

@Entity('promoted_listings')
export class PromotedListing extends BaseEntity {
  @ManyToOne(() => Provider, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'provider_id' })
  provider: Provider;

  @ManyToOne(() => ServiceCategory, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'category_id' })
  category: ServiceCategory | null;

  @Column({ name: 'bid_amount', type: 'decimal', precision: 10, scale: 2 })
  bidAmount: number;

  @Column({ name: 'start_date', type: 'date' })
  startDate: string;

  @Column({ name: 'end_date', type: 'date' })
  endDate: string;

  @Column({ name: 'priority', default: 0 })
  priority: number;

  @Column({ type: 'enum', enum: PromotedListingStatus, default: PromotedListingStatus.ACTIVE })
  status: PromotedListingStatus;

  @Column({ name: 'impressions', default: 0 })
  impressions: number;

  @Column({ name: 'clicks', default: 0 })
  clicks: number;
}