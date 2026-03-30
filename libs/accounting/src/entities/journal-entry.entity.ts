// libs/accounting/src/entities/journal-entry.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
} from 'typeorm';
import { LedgerLine } from './ledger-line.entity';

/**
 * JournalEntry
 * Immutable double-entry bookkeeping record.
 * Every entry must have ≥2 LedgerLines where ∑debit === ∑credit.
 * The immutableHash (SHA-256) of the lines payload prevents tampering.
 */
@Entity('journal_entries')
export class JournalEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Multi-tenancy isolation — every query must filter by this column */
  @Column({ name: 'tenant_id' })
  tenantId: string;

  @CreateDateColumn({ name: 'timestamp' })
  timestamp: Date;

  @Column({ nullable: true })
  narration: string;

  /**
   * SHA-256 hash of the serialised LedgerLine payload.
   * Used by the Anomaly Detector to flag any post-creation mutations.
   */
  @Column({ name: 'immutable_hash' })
  immutableHash: string;

  /** Optional reference to the source document (invoice, booking, …) */
  @Column({ name: 'source_type', nullable: true })
  sourceType: string;

  @Column({ name: 'source_id', nullable: true })
  sourceId: string;

  @OneToMany(() => LedgerLine, (line) => line.journalEntry, { cascade: true, eager: true })
  lines: LedgerLine[];
}
