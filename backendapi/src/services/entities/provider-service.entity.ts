import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Provider } from '../../users/entities/provider.entity';
import { ServiceCategory } from './service-category.entity';
import { PricingModel } from '../../common/enums/pricing-model.enum';

@Entity('provider_services')
export class ProviderService extends BaseEntity {
  @ManyToOne(() => Provider, (provider) => provider.services, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'provider_id' })
  provider: Provider;

  @ManyToOne(() => ServiceCategory, (category) => category.providerServices, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'category_id' })
  category: ServiceCategory;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  hourlyRate: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  dailyRate: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  fixedRate: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  unitRate: number;

  @Column({ type: 'varchar', nullable: true })
  pricingModel: PricingModel;

  @Column({ default: true })
  isActive: boolean;
}
