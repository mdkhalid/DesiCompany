import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { User } from '../../users/entities/user.entity';

@Entity('notifications')
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
}
