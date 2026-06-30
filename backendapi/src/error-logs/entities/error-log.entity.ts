import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { ErrorCategory } from '../enums/error-category.enum';

@Entity('error_logs')
@Index(['createdAt'])
@Index(['statusCode'])
@Index(['category'])
export class ErrorLog extends BaseEntity {
  @Column({ type: 'int' })
  statusCode: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  errorCode: string;

  @Column({
    type: 'enum',
    enum: ErrorCategory,
    nullable: true,
  })
  category: ErrorCategory;

  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'varchar', length: 10, nullable: true })
  method: string;

  @Column({ type: 'text', nullable: true })
  url: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  ip: string;

  @Column({ type: 'text', nullable: true, name: 'user_agent' })
  userAgent: string;

  @Column({ type: 'text', nullable: true })
  stack: string;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'user_id' })
  userId: string;

  @Column({ type: 'jsonb', nullable: true, name: 'request_body' })
  requestBody: Record<string, unknown>;

  @Column({
    type: 'varchar',
    length: 64,
    nullable: true,
    unique: true,
    name: 'fingerprint',
  })
  fingerprint: string;

  @Column({ type: 'timestamp', nullable: true, name: 'resolved_at' })
  resolvedAt: Date;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'resolved_by' })
  resolvedBy: string;
}
