import { Column, Entity, JoinColumn, ManyToOne, CreateDateColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { SupportTicket } from './support-ticket.entity';
import { User } from '../../users/entities/user.entity';

@Entity('support_ticket_messages')
export class SupportTicketMessage extends BaseEntity {
  @ManyToOne(() => SupportTicket, (ticket) => ticket.id, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ticket_id' })
  ticket: SupportTicket;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sender_id' })
  sender: User;

  @Column({ type: 'text' })
  message: string;

  @Column({ name: 'is_admin', default: false })
  isAdmin: boolean;

  @Column({ nullable: true })
  attachmentUrl: string;
}