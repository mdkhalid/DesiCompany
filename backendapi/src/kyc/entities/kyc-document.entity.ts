import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { KycStatus } from '../../common/enums/kyc-status.enum';
import { Provider } from '../../users/entities/provider.entity';

@Entity('kyc_documents')
export class KycDocument extends BaseEntity {
  @ManyToOne(() => Provider, (provider) => provider.kycDocuments, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'provider_id' })
  provider: Provider;

  @Column()
  documentType: string;

  @Column()
  documentUrl: string;

  @Column({ default: KycStatus.PENDING })
  status: KycStatus;

  @Column({ type: 'text', nullable: true })
  remarks: string | null;

  @Column({ nullable: true })
  reviewedBy: string;

  @Column({ nullable: true })
  reviewedAt: Date;
}
