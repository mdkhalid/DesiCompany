import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Booking } from './booking.entity';

export enum PhotoStage {
  BEFORE = 'before',
  DURING = 'during',
  AFTER = 'after',
}

@Entity('booking_photos')
export class BookingPhoto extends BaseEntity {
  @ManyToOne(() => Booking, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'booking_id' })
  booking: Booking;

  @Column({ type: 'enum', enum: PhotoStage })
  stage: PhotoStage;

  @Column()
  photoUrl: string;

  @Column({ nullable: true })
  caption: string;

  @Column({ default: 0 })
  displayOrder: number;
}
