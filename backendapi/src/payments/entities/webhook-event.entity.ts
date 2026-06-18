import { Column, Entity, Unique } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

@Entity('webhook_events')
@Unique(['gateway', 'eventId'])
export class WebhookEvent extends BaseEntity {
  @Column({ type: 'varchar', length: 50 })
  gateway: string;

  @Column({ name: 'event_id' })
  eventId: string;

  @Column({ type: 'jsonb' })
  payload: Record<string, unknown>;

  @Column({ type: 'timestamp', nullable: true, name: 'processed_at' })
  processedAt: Date | null;
}
