import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { User } from '../../users/entities/user.entity';
import { Booking } from '../../bookings/entities/booking.entity';

export enum MessageType {
  TEXT = 'text',
  IMAGE = 'image',
  QUOTE = 'quote',
  QUICK_REPLY = 'quick_reply',
}

@Entity('messages')
export class Message extends BaseEntity {
  @ManyToOne(() => Booking, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'booking_id' })
  booking: Booking;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sender_id' })
  sender: User;

  @Column({ type: 'text' })
  content: string;

  @Column({ default: false })
  isRead: boolean;

  @Column({ type: 'varchar', length: 50, default: MessageType.TEXT })
  messageType: MessageType;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;
}
