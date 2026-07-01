import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Booking } from './booking.entity';
import { ProviderService } from '../../services/entities/provider-service.entity';

@Entity('booking_services')
export class BookingServiceItem extends BaseEntity {
  @ManyToOne(() => Booking, (booking) => booking.serviceItems, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'booking_id' })
  booking: Booking;

  @ManyToOne(() => ProviderService, { nullable: false })
  @JoinColumn({ name: 'provider_service_id' })
  providerService: ProviderService;

  @Column({ name: 'sequence_order', default: 0 })
  sequenceOrder: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  rateAtBooking: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  estimatedHours: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  estimatedDays: number | null;
}
