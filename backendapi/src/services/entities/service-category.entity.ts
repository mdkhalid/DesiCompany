import { Column, Entity, OneToMany } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { CommissionType } from '../../common/enums/commission-type.enum';
import { ProviderService } from './provider-service.entity';

@Entity('service_categories')
export class ServiceCategory extends BaseEntity {
  @Column({ unique: true })
  nameEn: string;

  @Column()
  nameHi: string;

  @Column({ nullable: true })
  icon: string;

  @Column({ default: CommissionType.PERCENTAGE })
  commissionType: CommissionType;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 10 })
  commissionValue: number;

  @Column({ default: true })
  isActive: boolean;

  @OneToMany(
    () => ProviderService,
    (providerService) => providerService.category,
  )
  providerServices?: ProviderService[];
}
