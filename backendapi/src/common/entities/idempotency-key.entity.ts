import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

@Entity('idempotency_keys')
@Index(['key'], { unique: true })
@Index(['expiresAt'])
export class IdempotencyKey extends BaseEntity {
  @Column({ type: 'varchar', length: 255 })
  key: string;

  @Column({ type: 'jsonb', nullable: true })
  result: any;

  @Column({ type: 'timestamp', nullable: true })
  expiresAt: Date;
}
