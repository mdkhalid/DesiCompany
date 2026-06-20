import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

@Entity('promo_codes')
export class PromoCode extends BaseEntity {
  @Column({ unique: true })
  code: string;

  @Column()
  type: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  value: number;

  @Column({ name: 'max_uses', nullable: true })
  maxUses: number;

  @Column({ name: 'current_uses', default: 0 })
  currentUses: number;

  @Column({ type: 'timestamp', name: 'valid_from', nullable: true })
  validFrom: Date;

  @Column({ type: 'timestamp', name: 'valid_until', nullable: true })
  validUntil: Date;

  @Column({ default: true, name: 'is_active' })
  isActive: boolean;

  @Column({ type: 'jsonb', nullable: true })
  restrictions: Record<string, any>;
}
