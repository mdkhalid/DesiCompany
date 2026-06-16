import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { CommissionType } from '../../common/enums/commission-type.enum';

@Entity('commission_configs')
export class CommissionConfig extends BaseEntity {
  @Column()
  scope: string;

  @Column({ nullable: true })
  scopeId: string;

  @Column({ default: CommissionType.PERCENTAGE })
  type: CommissionType;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  value: number;

  @Column({ default: true })
  isActive: boolean;
}
