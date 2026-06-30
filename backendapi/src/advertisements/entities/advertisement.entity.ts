import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

export enum AdPlacement {
  HOME_BANNER = 'home_banner',
  CATEGORY_TOP = 'category_top',
  SEARCH_RESULTS_TOP = 'search_results_top',
  SEARCH_RESULTS_INLINE = 'search_results_inline',
  PROVIDER_LIST_TOP = 'provider_list_top',
  BOOKING_CONFIRMATION = 'booking_confirmation',
  NOTIFICATION_AD = 'notification_ad',
  SPLASH_SCREEN = 'splash_screen',
  FOOTER_BANNER = 'footer_banner',
}

export enum AdStatus {
  DRAFT = 'draft',
  SCHEDULED = 'scheduled',
  ACTIVE = 'active',
  PAUSED = 'paused',
  EXPIRED = 'expired',
}

export enum AdTargetAudience {
  ALL = 'all',
  CUSTOMERS = 'customers',
  PROVIDERS = 'providers',
  NEW_USERS = 'new_users',
  RETURNING_USERS = 'returning_users',
}

@Entity('advertisements')
export class Advertisement extends BaseEntity {
  @Column({ name: 'title', length: 200 })
  title: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description: string;

  @Column({ name: 'image_url', length: 500 })
  imageUrl: string;

  @Column({ name: 'thumbnail_url', length: 500, nullable: true })
  thumbnailUrl: string;

  @Column({ name: 'target_url', length: 500, nullable: true })
  targetUrl: string;

  @Column({ name: 'target_screen', length: 100, nullable: true })
  targetScreen: string;

  @Column({
    type: 'enum',
    enum: AdPlacement,
  })
  placement: AdPlacement;

  @Column({
    type: 'enum',
    enum: AdStatus,
    default: AdStatus.DRAFT,
  })
  status: AdStatus;

  @Column({
    type: 'enum',
    enum: AdTargetAudience,
    default: AdTargetAudience.ALL,
  })
  targetAudience: AdTargetAudience;

  @Column({ name: 'start_date', type: 'timestamp' })
  startDate: Date;

  @Column({ name: 'end_date', type: 'timestamp' })
  endDate: Date;

  @Column({ name: 'priority', default: 0, comment: 'Higher priority shows first' })
  priority: number;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'impressions', default: 0 })
  impressions: number;

  @Column({ name: 'clicks', default: 0 })
  clicks: number;

  @Column({ name: 'unique_impressions', default: 0 })
  uniqueImpressions: number;

  @Column({ name: 'unique_clicks', default: 0 })
  uniqueClicks: number;

  @Column({ name: 'category_id', nullable: true })
  categoryId: string;

  @Column({ name: 'max_impressions', nullable: true, comment: 'Limit total impressions, null = unlimited' })
  maxImpressions: number;

  @Column({ name: 'max_clicks', nullable: true, comment: 'Limit total clicks, null = unlimited' })
  maxClicks: number;

  @Column({ name: 'daily_impression_limit', nullable: true })
  dailyImpressionLimit: number;

  @Column({ name: 'show_close_button', default: true })
  showCloseButton: boolean;

  @Column({ name: 'auto_close_seconds', nullable: true, comment: 'Auto close after X seconds, null = no auto close' })
  autoCloseSeconds: number;

  @Column({ name: 'background_color', length: 20, nullable: true })
  backgroundColor: string;

  @Column({ name: 'text_color', length: 20, nullable: true })
  textColor: string;

  @Column({ name: 'created_by', nullable: true })
  createdBy: string;

  @Column({ name: 'notes', type: 'text', nullable: true, comment: 'Internal admin notes' })
  notes: string;
}
