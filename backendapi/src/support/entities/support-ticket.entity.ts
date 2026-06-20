import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { User } from '../../users/entities/user.entity';

export enum SupportTicketStatus {
  OPEN = 'open',
  IN_PROGRESS = 'in_progress',
  RESOLVED = 'resolved',
  CLOSED = 'closed',
}

export enum SupportTicketCategory {
  BOOKING_ISSUE = 'booking_issue',
  PAYMENT_ISSUE = 'payment_issue',
  ACCOUNT_ISSUE = 'account_issue',
  TECHNICAL_ISSUE = 'technical_issue',
  OTHER = 'other',
}

@Entity('support_tickets')
export class SupportTicket extends BaseEntity {
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column()
  subject: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'enum', enum: SupportTicketCategory })
  category: SupportTicketCategory;

  @Column({
    type: 'enum',
    enum: SupportTicketStatus,
    default: SupportTicketStatus.OPEN,
  })
  status: SupportTicketStatus;

  @Column({ name: 'assigned_admin_id', nullable: true, type: 'varchar' })
  assignedAdminId: string | null;

  @Column({ name: 'resolution_notes', nullable: true, type: 'text' })
  resolutionNotes: string | null;

  @Column({ name: 'resolved_at', type: 'timestamp', nullable: true })
  resolvedAt: Date | null;

  @Column({ name: 'priority', default: 0 })
  priority: number;
}
