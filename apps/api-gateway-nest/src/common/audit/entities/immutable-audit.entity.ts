// apps/api-gateway-nest/src/common/audit/entities/immutable-audit.entity.ts
import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

/**
 * ImmutableAuditLog
 * Every record is hashed with SHA-256. The hash covers userId + action + details + timestamp,
 * making any post-write mutation detectable. Records are never deleted — only appended.
 */
@Entity('immutable_audit_logs')
export class ImmutableAuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column()
  action: string;

  @Column({ name: 'tenant_id', nullable: true })
  tenantId: string;

  @Column({ type: 'jsonb', nullable: true })
  details: any;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  timestamp: Date;

  /** SHA-256(userId + action + details + timestamp) */
  @Column()
  hash: string;
}
