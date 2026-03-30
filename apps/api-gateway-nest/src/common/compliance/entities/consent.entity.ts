// apps/api-gateway-nest/src/common/compliance/entities/consent.entity.ts
import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

/**
 * Consent — GDPR/DPDP Act consent record.
 * Immutable history is preserved by inserting new rows rather than updating.
 */
@Entity('user_consents')
export class Consent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'tenant_id', nullable: true })
  tenantId: string;

  /** Purpose: "marketing" | "analytics" | "data-sharing" | "ai-profiling" */
  @Column()
  purpose: string;

  @Column({ default: true })
  granted: boolean;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  timestamp: Date;
}
