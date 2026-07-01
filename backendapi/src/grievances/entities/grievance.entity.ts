import { Column, Entity, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { User } from '../../users/entities/user.entity';
import { Booking } from '../../bookings/entities/booking.entity';
import { GrievanceMessage } from './grievance-message.entity';

export enum GrievanceCategory {
  SERVICE_QUALITY = 'service_quality',
  DELAY_NO_SHOW = 'delay_no_show',
  BILLING_OVERCHARGE = 'billing_overcharge',
  DAMAGED_PROPERTY = 'damaged_property',
  RUDE_BEHAVIOR = 'rude_behavior',
  INCOMPLETE_WORK = 'incomplete_work',
  WRONG_SERVICE = 'wrong_service',
  OTHER = 'other',
}

export enum GrievanceStatus {
  OPEN = 'open',
  IN_PROGRESS = 'in_progress',
  ESCALATED = 'escalated',
  ADMIN_REVIEW = 'admin_review',
  RESOLVED = 'resolved',
  CLOSED = 'closed',
}

export enum GrievancePriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent',
}

export enum ResolutionType {
  DISCOUNT_COUPON = 'discount_coupon',
  AUTO_RESCHEDULE = 'auto_reschedule',
  REFUND = 'refund',
  ESCALATED_TO_ADMIN = 'escalated_to_admin',
  PROVIDER_FEEDBACK = 'provider_feedback',
  NO_ACTION = 'no_action',
}

@Entity('grievances')
export class Grievance extends BaseEntity {
  @ManyToOne(() => Booking, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'booking_id' })
  booking: Booking;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'customer_id' })
  customer: User;

  @Column({
    type: 'enum',
    enum: GrievanceCategory,
  })
  category: GrievanceCategory;

  @Column({
    type: 'enum',
    enum: GrievanceStatus,
    default: GrievanceStatus.OPEN,
  })
  status: GrievanceStatus;

  @Column({
    type: 'enum',
    enum: GrievancePriority,
    default: GrievancePriority.MEDIUM,
  })
  priority: GrievancePriority;

  @Column({ name: 'subject', length: 200, nullable: true })
  subject: string | null;

  @Column({ name: 'description', type: 'text', nullable: true })
  description: string | null;

  @Column({
    name: 'resolution_type',
    type: 'enum',
    enum: ResolutionType,
    nullable: true,
  })
  resolutionType: ResolutionType | null;

  @Column({ name: 'resolution_details', type: 'text', nullable: true })
  resolutionDetails: string | null;

  @Column({ name: 'resolved_at', type: 'timestamp', nullable: true })
  resolvedAt: Date | null;

  @Column({ name: 'resolved_by', nullable: true })
  resolvedBy: string | null;

  @Column({ name: 'admin_notes', type: 'text', nullable: true })
  adminNotes: string | null;

  @Column({ name: 'admin_call_initiated', default: false })
  adminCallInitiated: boolean;

  @Column({ name: 'admin_call_notes', type: 'text', nullable: true })
  adminCallNotes: string | null;

  @Column({ name: 'coupon_code', length: 50, nullable: true })
  couponCode: string;

  @Column({ name: 'reschedule_booking_id', nullable: true })
  rescheduleBookingId: string;

  @OneToMany(() => GrievanceMessage, (msg) => msg.grievance, { cascade: true })
  messages: GrievanceMessage[];
}
