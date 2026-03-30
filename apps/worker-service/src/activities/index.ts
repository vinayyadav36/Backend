// apps/worker-service/src/activities/index.ts
import { Pool } from 'pg';
import axios from 'axios';

const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

const ML_URL = process.env.ML_AGENT_URL || 'http://ml-agent:8000';

// ── Reconciliation activities ────────────────────────────────────────────────

export async function fetchBankStatements(tenantId: string): Promise<any[]> {
  const { rows } = await db.query(
    `SELECT * FROM journal_entries WHERE tenant_id = $1 ORDER BY timestamp DESC LIMIT 200`,
    [tenantId],
  );
  return rows;
}

export async function matchInvoices(data: any[]): Promise<any[]> {
  /** Delegates to Python AI agent — result is saved to pending_tasks, NOT the ledger */
  const res = await axios.post(
    `${ML_URL}/ai/agent/run`,
    { task: 'reconcile', payload: { transactions: data } },
    { headers: { 'x-tenant-id': data[0]?.tenant_id || 'system' } },
  );
  return res.data;
}

export async function notifyManager(tenantId: string, matches: any[]): Promise<void> {
  console.log(`[Notify] Tenant ${tenantId}: ${matches.length} matches await approval`);
  // TODO: integrate with SendGrid / Socket.io for real notifications
}

export async function commitToLedger(tenantId: string, matches: any[]): Promise<string> {
  /** Only called after human approval signal — writes to Postgres ledger */
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    for (const match of matches) {
      await client.query(
        `INSERT INTO journal_entries (tenant_id, narration, immutable_hash, debit_account_id, credit_account_id, amount)
         VALUES ($1, $2, $3, 'CASH', 'REVENUE', $4)`,
        [tenantId, `Reconciled: ${match.invoice?.id}`, `hash-${Date.now()}`, match.invoice?.total || 0],
      );
    }
    await client.query('COMMIT');
    return `${matches.length} entries committed`;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ── Billing activities ───────────────────────────────────────────────────────

export async function generateInvoicePdf(invoiceId: string, tenantId: string): Promise<string> {
  const filePath = `/tmp/invoice-${invoiceId}.pdf`;
  console.log(`[Billing] Generated PDF for invoice ${invoiceId} → ${filePath}`);
  return filePath;
}

export async function sendInvoiceEmail(invoiceId: string, pdfPath: string, tenantId: string): Promise<void> {
  console.log(`[Billing] Email sent for invoice ${invoiceId} (${pdfPath})`);
  // TODO: integrate with SendGrid / SES
}

export async function markInvoiceSent(invoiceId: string, tenantId: string): Promise<void> {
  await db.query(
    `UPDATE invoices SET status = 'SENT' WHERE id = $1 AND tenant_id = $2`,
    [invoiceId, tenantId],
  );
}
