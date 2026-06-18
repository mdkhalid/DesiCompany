import { Column, Entity, Unique } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { PaymentGatewayType } from '../../common/enums/payment-gateway-type.enum';

@Entity('payment_gateway_configs')
@Unique('UQ_payment_gateway_type', ['type'])
export class PaymentGatewayConfig extends BaseEntity {
  @Column({
    type: 'enum',
    enum: PaymentGatewayType,
  })
  type: PaymentGatewayType;

  @Column()
  displayName: string;

  @Column({ type: 'text', name: 'encrypted_credentials' })
  encryptedCredentials: string;

  @Column({ type: 'text' })
  iv: string;

  @Column({ type: 'text', name: 'auth_tag' })
  authTag: string;

  @Column({ default: true, name: 'is_active' })
  isActive: boolean;

  @Column({ default: false, name: 'is_default' })
  isDefault: boolean;
}
