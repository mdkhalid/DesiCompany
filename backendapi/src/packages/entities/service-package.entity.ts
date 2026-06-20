import {
  Column,
  Entity,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
} from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Provider } from '../../users/entities/provider.entity';
import { ProviderService } from '../../services/entities/provider-service.entity';

@Entity('service_packages')
export class ServicePackage extends BaseEntity {
  @ManyToOne(() => Provider, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'provider_id' })
  provider: Provider;

  @Column()
  name: string;

  @Column({ nullable: true })
  description: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  bundlePrice: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  originalPrice: number;

  @Column({ name: 'discount_percent', default: 0 })
  discountPercent: number;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @ManyToMany(() => ProviderService)
  @JoinTable({
    name: 'service_package_items',
    joinColumn: { name: 'package_id' },
    inverseJoinColumn: { name: 'provider_service_id' },
  })
  services: ProviderService[];
}
