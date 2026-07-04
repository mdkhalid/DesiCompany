import { Column, Entity, JoinColumn, ManyToOne, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { User } from '../../users/entities/user.entity';
import { UserRole } from '../../common/enums/user-role.enum';

@Entity('notifications')
@Index(['user', 'recipientRole'])
export class Notification extends BaseEntity {
  @ManyToOne(() => User, (user) => user.notifications, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column()
  title: string;

  @Column()
  message: string;

  @Column({ nullable: true })
  type: string;

  @Column('jsonb', { nullable: true })
  metadata: Record<string, unknown>;

  @Column({ default: false })
  isRead: boolean;

  // The role context this notification belongs to (customer or provider).
  // For dual-role users, this ensures notifications only show in the correct
  // role's view (e.g., provider booking messages only show in provider view).
  @Column({ type: 'enum', enum: UserRole, nullable: true, name: 'recipient_role' })
  recipientRole: UserRole;
}
