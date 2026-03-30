// libs/accounting/src/entities/ledger-line.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { JournalEntry } from './journal-entry.entity';

/**
 * LedgerLine
 * One debit or credit leg of a double-entry journal entry.
 * accountId references the Chart of Accounts
 * (e.g. 'CASH', 'REVENUE', 'GST_OUTPUT', 'ACCOUNTS_RECEIVABLE').
 */
@Entity('ledger_lines')
export class LedgerLine {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Amount debited on this account. Exactly one of debit/credit must be non-zero. */
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  debit: number;

  /** Amount credited on this account. */
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  credit: number;

  /** References the Chart of Accounts: CASH, REVENUE, GST_OUTPUT, ACCOUNTS_RECEIVABLE … */
  @Column({ name: 'account_id' })
  accountId: string;

  @Column({ nullable: true })
  description: string;

  @ManyToOne(() => JournalEntry, (entry) => entry.lines, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'journal_entry_id' })
  journalEntry: JournalEntry;
}
