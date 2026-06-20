import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Provider } from '../../users/entities/provider.entity';

export enum VerificationVideoStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

@Entity('verification_videos')
export class VerificationVideo extends BaseEntity {
  @ManyToOne(() => Provider, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'provider_id' })
  provider: Provider;

  @Column()
  videoUrl: string;

  @Column({ name: 'thumbnail_url', nullable: true })
  thumbnailUrl: string;

  @Column({ name: 'duration_seconds', default: 30 })
  durationSeconds: number;

  @Column({ type: 'enum', enum: VerificationVideoStatus, default: VerificationVideoStatus.PENDING })
  status: VerificationVideoStatus;

  @Column({ nullable: true, type: 'text' })
  reviewerNotes: string | null;

  @Column({ name: 'reviewed_at', type: 'timestamp', nullable: true })
  reviewedAt: Date | null;
}