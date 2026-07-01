import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Grievance } from './grievance.entity';

export enum MessageSender {
  BOT = 'bot',
  CUSTOMER = 'customer',
  ADMIN = 'admin',
  SYSTEM = 'system',
}

@Entity('grievance_messages')
export class GrievanceMessage extends BaseEntity {
  @ManyToOne(() => Grievance, (grievance) => grievance.messages, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'grievance_id' })
  grievance: Grievance;

  @Column({
    type: 'enum',
    enum: MessageSender,
  })
  sender: MessageSender;

  @Column({ name: 'content', type: 'text' })
  content: string;

  @Column({ name: 'metadata', type: 'jsonb', nullable: true })
  metadata: Record<string, unknown>;

  @Column({ name: 'is_read', default: false })
  isRead: boolean;
}
