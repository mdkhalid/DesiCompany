import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Provider } from '../../users/entities/provider.entity';
import { ServiceCategory } from '../../services/entities/service-category.entity';

@Entity('portfolio_items')
export class PortfolioItem extends BaseEntity {
  @ManyToOne(() => Provider, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'provider_id' })
  provider: Provider;

  @ManyToOne(() => ServiceCategory, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'category_id' })
  category: ServiceCategory | null;

  @Column()
  title: string;

  @Column({ nullable: true })
  description: string;

  @Column({ name: 'image_url' })
  imageUrl: string;

  @Column({ name: 'display_order', default: 0 })
  displayOrder: number;
}