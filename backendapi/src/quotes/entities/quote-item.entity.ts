import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Quote } from './quote.entity';

@Entity('quote_items')
export class QuoteItem extends BaseEntity {
  @ManyToOne(() => Quote, (quote) => quote.items, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'quote_id' })
  quote: Quote;

  @Column({ length: 500 })
  description: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 1 })
  quantity: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  unitPrice: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  totalPrice: number;
}
