import { Column, Entity, JoinColumn, OneToMany, OneToOne } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { User } from './user.entity';
import { KycDocument } from '../../kyc/entities/kyc-document.entity';
import { ProviderService } from '../../services/entities/provider-service.entity';
import { Booking } from '../../bookings/entities/booking.entity';
import { Review } from '../../reviews/entities/review.entity';
import { ProviderAvailability } from '../../services/entities/provider-availability.entity';

@Entity('providers')
export class Provider extends BaseEntity {
  @OneToOne(() => User, (user) => user.provider)
  @JoinColumn()
  user: User;

  @Column()
  firstName: string;

  @Column({ nullable: true })
  lastName: string;

  @Column({ nullable: true })
  bio: string;

  @Column({ nullable: true, type: 'decimal', precision: 10, scale: 2 })
  experienceYears: number;

  @Column({ nullable: true })
  address: string;

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

  @Column({ default: false })
  isVerified: boolean;

  @Column({ default: false, name: 'is_soft_blocked' })
  isSoftBlocked: boolean;

  @Column({ type: 'decimal', precision: 3, scale: 2, default: 0 })
  averageRating: number;

  @Column({ default: 0 })
  totalReviews: number;

  @OneToMany(() => KycDocument, (kycDocument) => kycDocument.provider)
  kycDocuments?: KycDocument[];

  @OneToMany(
    () => ProviderService,
    (providerService) => providerService.provider,
  )
  services?: ProviderService[];

  @OneToMany(
    () => ProviderAvailability,
    (availability) => availability.provider,
  )
  availabilities?: ProviderAvailability[];

  @OneToMany(() => Booking, (booking) => booking.provider)
  bookings?: Booking[];

  @OneToMany(() => Review, (review) => review.provider)
  reviews?: Review[];
}
