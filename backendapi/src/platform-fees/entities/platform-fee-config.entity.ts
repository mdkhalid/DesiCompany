import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

@Entity('platform_fee_configs')
export class PlatformFeeConfig extends BaseEntity {
  @Column({ name: 'config_key' })
  configKey: string;

  @Column({ type: 'jsonb', nullable: true, name: 'config_value' })
  configValue: Record<string, unknown>;

  @Column({ default: true, name: 'is_active' })
  isActive: boolean;

  @Column({ nullable: true })
  description: string;
}
