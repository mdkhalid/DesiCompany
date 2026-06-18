import { Column, Entity, OneToMany, OneToOne } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { UserRole } from '../../common/enums/user-role.enum';
import { UserStatus } from '../../common/enums/user-status.enum';
import { Customer } from './customer.entity';
import { Provider } from './provider.entity';
import { Notification } from '../../notifications/entities/notification.entity';

@Entity('users')
export class User extends BaseEntity {
  @Column({ unique: true })
  phone: string;

  @Column({ nullable: true })
  email: string;

  @Column()
  role: UserRole;

  @Column({ default: UserStatus.ACTIVE })
  status: UserStatus;

  @Column({ nullable: true })
  profileImage: string;

  @Column({ default: 'en' })
  language: string;

  @OneToOne(() => Customer, (customer) => customer.user)
  customer?: Customer;

  @OneToOne(() => Provider, (provider) => provider.user)
  provider?: Provider;

  @OneToMany(() => Notification, (notification) => notification.user)
  notifications?: Notification[];
}
