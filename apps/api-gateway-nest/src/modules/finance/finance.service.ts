// apps/api-gateway-nest/src/modules/finance/finance.service.ts
import { Injectable, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as crypto from 'crypto';
import { JournalEntry } from '@libs/accounting';
import { LedgerLine } from '@libs/accounting';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { CreateInvoiceDto } from './dto/create-invoice.dto';

@Injectable()
export class FinanceService {
  constructor(private readonly dataSource: DataSource) {}

  /**
   * Post a double-entry journal entry after validating debit === credit.
   * Runs inside an ACID transaction — any failure rolls back entirely.
   */
  async createTransaction(
    tenantId: string,
    dto: CreateTransactionDto,
  ): Promise<JournalEntry> {
    const totalDebit = dto.lines.reduce((s, l) => s + (l.debit || 0), 0);
    const totalCredit = dto.lines.reduce((s, l) => s + (l.credit || 0), 0);

    if (Math.abs(totalDebit - totalCredit) > 0.001) {
      throw new BadRequestException(
        `Accounting Error: Debits (${totalDebit}) and Credits (${totalCredit}) must balance.`,
      );
    }

    const immutableHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(dto.lines))
      .digest('hex');

    return this.dataSource.transaction(async (manager) => {
      const entry = manager.create(JournalEntry, {
        tenantId,
        narration: dto.narration,
        sourceType: dto.sourceType,
        sourceId: dto.sourceId,
        immutableHash,
        lines: dto.lines.map((l) =>
          manager.create(LedgerLine, {
            accountId: l.accountId,
            debit: l.debit,
            credit: l.credit,
            description: l.description,
          }),
        ),
      });
      return manager.save(entry);
    });
  }

  /**
   * Create a GST-compliant invoice and auto-post the matching journal entry.
   *
   * GST split (e.g. 18 %):
   *   Debit  ACCOUNTS_RECEIVABLE   = subtotal + gstAmount
   *   Credit REVENUE               = subtotal
   *   Credit GST_OUTPUT_TAX        = gstAmount
   */
  async createGstInvoice(
    tenantId: string,
    dto: CreateInvoiceDto,
  ): Promise<{ invoice: Record<string, unknown>; journalEntry: JournalEntry }> {
    const gstAmount = parseFloat(((dto.subtotal * dto.gstRate) / 100).toFixed(2));
    const total = parseFloat((dto.subtotal + gstAmount).toFixed(2));

    const lines = [
      { accountId: 'ACCOUNTS_RECEIVABLE', debit: total,      credit: 0,         description: `AR for invoice` },
      { accountId: 'REVENUE',             debit: 0,          credit: dto.subtotal, description: 'Sales revenue' },
      { accountId: 'GST_OUTPUT_TAX',      debit: 0,          credit: gstAmount,  description: `GST @ ${dto.gstRate}%` },
    ];

    const journalEntry = await this.createTransaction(tenantId, {
      lines,
      narration: dto.narration || `GST Invoice — ${dto.customerId}`,
      sourceType: 'invoice',
    });

    const invoice = {
      tenantId,
      customerId: dto.customerId,
      issueDate: dto.issueDate,
      dueDate: dto.dueDate,
      lineItems: dto.lineItems,
      subtotal: dto.subtotal,
      gstRate: dto.gstRate,
      taxTotal: gstAmount,
      total,
      currency: dto.currency || 'INR',
      status: 'DRAFT',
      journalEntryId: journalEntry.id,
    };

    return { invoice, journalEntry };
  }

  /** GET /finance/summary — balance per account for the tenant */
  async getFinanceSummary(tenantId: string) {
    return this.dataSource.query(
      `SELECT account_id, SUM(debit) - SUM(credit) AS balance, SUM(debit) AS total_debit, SUM(credit) AS total_credit
       FROM ledger_lines ll
       JOIN journal_entries je ON ll.journal_entry_id = je.id
       WHERE je.tenant_id = $1
       GROUP BY account_id
       ORDER BY account_id`,
      [tenantId],
    );
  }
}
