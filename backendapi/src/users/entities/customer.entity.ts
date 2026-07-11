import { Column, Entity, JoinColumn, OneToMany, OneToOne } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { User } from './user.entity';
import { Booking } from '../../bookings/entities/booking.entity';

@Entity('customers')
export class Customer extends BaseEntity {
  @OneToOne(() => User, (user) => user.customer)
  @JoinColumn()
  user: User;

  @Column()
  firstName: string;

  @Column({ nullable: true })
  lastName: string;

  @Column({ nullable: true })
  address: string;

  @Column({ nullable: true })
  locality: string;

  @Column({ nullable: true })
  landmark: string;

  @Column({ nullable: true })
  city: string;

  @Column({ nullable: true })
  state: string;

  @Column({ nullable: true })
  pincode: string;

  @Column({ type: 'decimal', precision: 10, scale: 6, nullable: true })
  latitude: number;

  @Column({ type: 'decimal', precision: 10, scale: 6, nullable: true })
  longitude: number;

  @OneToMany(() => Booking, (booking) => booking.customer)
  bookings?: Booking[];
}
