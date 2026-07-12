import { Column, Entity, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { User } from '../../users/entities/user.entity';
import { Provider } from '../../users/entities/provider.entity';
import { Customer } from '../../users/entities/customer.entity';

export enum DirectMessageType {
  TEXT = 'text',
  IMAGE = 'image',
  QUOTE = 'quote',
  QUICK_REPLY = 'quick_reply',
  LOCATION = 'location',
  DOCUMENT = 'document',
}

@Entity('direct_messages')
export class DirectMessage extends BaseEntity {
  @ManyToOne(() => Customer)
  customer: Customer;

  @ManyToOne(() => Provider)
  provider: Provider;

  @ManyToOne(() => User)
  sender: User;

  @Column({ type: 'text' })
  content: string;

  @Column({ default: false })
  isRead: boolean;

  @Column({ type: 'varchar', length: 50, default: DirectMessageType.TEXT })
  messageType: DirectMessageType;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown>;

  @Column({ default: false })
  edited: boolean;

  @Column({ default: false })
  deleted: boolean;

  @Column({ default: false })
  isArchived: boolean;
}
