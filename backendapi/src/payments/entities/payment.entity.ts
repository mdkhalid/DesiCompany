import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { PaymentGatewayType } from '../../common/enums/payment-gateway-type.enum';
import { PaymentMethod } from '../../common/enums/payment-method.enum';
import { PaymentStatus } from '../../common/enums/payment-status.enum';
import { Booking } from '../../bookings/entities/booking.entity';

@Entity('payments')
@Index(['createdAt'])
export class Payment extends BaseEntity {
  @ManyToOne(() => Booking, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'booking_id' })
  @Index()
  booking: Booking | null;

  @Column({ nullable: true, name: 'purpose_type' })
  purposeType: string;

  @Column({ nullable: true, name: 'purpose_id' })
  purposeId: string;

  @Column()
  method: PaymentMethod;

  @Column({ default: PaymentStatus.PENDING })
  @Index()
  status: PaymentStatus;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({ nullable: true })
  transactionId: string;

  @Column({ nullable: true })
  gatewayResponse: string;

  @Column({
    type: 'enum',
    enum: PaymentGatewayType,
    nullable: true,
    name: 'gateway',
  })
  @Index()
  gateway: PaymentGatewayType;

  @Column({
    type: 'varchar',
    length: 200,
    nullable: true,
    name: 'gateway_order_id',
  })
  gatewayOrderId: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown>;
}
