import { Column, Entity, OneToMany } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

@Entity('cities')
export class City extends BaseEntity {
  @Column({ unique: true })
  nameEn: string;

  @Column()
  nameHi: string;

  @Column({ nullable: true })
  state: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: 0 })
  sortOrder: number;

  @OneToMany('User', (user: any) => user.city)
  users?: any[];

  @OneToMany('Provider', (provider: any) => provider.city)
  providers?: any[];

  @OneToMany('JobRequest', (jr: any) => jr.city)
  jobRequests?: any[];

  @OneToMany('Booking', (booking: any) => booking.city)
  bookings?: any[];
}
