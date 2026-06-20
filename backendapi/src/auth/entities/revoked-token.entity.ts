import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

@Entity('revoked_tokens')
export class RevokedToken extends BaseEntity {
  @Index()
  @Column()
  token: string;

  @Column({ type: 'timestamp' })
  expiresAt: Date;
}
