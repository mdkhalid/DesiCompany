import { Column, Entity, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { User } from '../../users/entities/user.entity';
import { Provider } from '../../users/entities/provider.entity';

@Entity('direct_messages')
export class DirectMessage extends BaseEntity {
  @ManyToOne(() => User)
  customer: User;

  @ManyToOne(() => Provider)
  provider: Provider;

  @ManyToOne(() => User)
  sender: User;

  @Column({ type: 'text' })
  content: string;

  @Column({ default: false })
  isRead: boolean;
}
