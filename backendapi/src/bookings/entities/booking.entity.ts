import { Column, Entity, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { BookingStatus } from '../../common/enums/booking-status.enum';
import { Customer } from '../../users/entities/customer.entity';
import { Provider } from '../../users/entities/provider.entity';
import { ProviderService } from '../../services/entities/provider-service.entity';
import { BookingCharge } from './booking-charge.entity';
import { BookingServiceItem } from './booking-service-item.entity';
import { Quote } from '../../quotes/entities/quote.entity';
import { PricingModel } from '../../common/enums/pricing-model.enum';

@Entity('bookings')
export class Booking extends BaseEntity {
  @ManyToOne(() => Customer, (customer) => customer.bookings, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;

  @ManyToOne(() => Provider, (provider) => provider.bookings, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'provider_id' })
  provider: Provider;

  @ManyToOne(() => ProviderService, { nullable: true })
  @JoinColumn({ name: 'provider_service_id' })
  providerService: ProviderService;

  @ManyToOne(() => Quote, { nullable: true })
  @JoinColumn({ name: 'quote_id' })
  quote: Quote;

  @Column({ default: BookingStatus.REQUESTED })
  status: BookingStatus;

  @Column()
  scheduledDate: Date;

  @Column({ nullable: true })
  description: string;

  @Column({ nullable: true, name: 'service_address' })
  serviceAddress?: string;

  @Column({ nullable: true, name: 'service_city' })
  serviceCity?: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  totalAmount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  commissionAmount: number;

  @Column({ default: false, name: 'commission_waived' })
  commissionWaived: boolean;

  @Column({ type: 'varchar', nullable: true, name: 'commission_waived_reason' })
  commissionWaivedReason?: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  providerAmount: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
    name: 'convenience_fee',
  })
  convenienceFee: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
    name: 'gst_amount',
  })
  gstAmount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  estimatedHours: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  estimatedDays: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  unitCount: number;

  @Column({ type: 'varchar', nullable: true })
  pricingModel: PricingModel;

  @Column({ type: 'timestamp', nullable: true })
  proposedDate: Date | null;

  @Column({ name: 'is_emergency', default: false })
  isEmergency: boolean;

  @OneToMany(() => BookingCharge, (charge) => charge.booking)
  charges?: BookingCharge[];

  @OneToMany(() => BookingServiceItem, (item) => item.booking)
  serviceItems?: BookingServiceItem[];
}
