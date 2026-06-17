import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { PaymentGatewayType } from '../../common/enums/payment-gateway-type.enum';
import { PaymentMethod } from '../../common/enums/payment-method.enum';
import { PaymentStatus } from '../../common/enums/payment-status.enum';
import { Booking } from '../../bookings/entities/booking.entity';

@Entity('payments')
export class Payment extends BaseEntity {
  @ManyToOne(() => Booking, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'booking_id' })
  booking: Booking;

  @Column()
  method: PaymentMethod;

  @Column({ default: PaymentStatus.PENDING })
  status: PaymentStatus;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({ nullable: true })
  transactionId: string;

  @Column({ nullable: true })
  gatewayResponse: string;

  @Column({ type: 'enum', enum: PaymentGatewayType, nullable: true, name: 'gateway' })
  gateway: PaymentGatewayType;

  @Column({ type: 'varchar', length: 200, nullable: true, name: 'gateway_order_id' })
  gatewayOrderId: string;
}
