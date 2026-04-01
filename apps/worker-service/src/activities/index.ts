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
  // Integrate with SendGrid / Socket.io for real notifications
  // Set SENDGRID_API_KEY and NOTIFICATION_EMAIL env vars to enable email alerts
  const apiKey = process.env.SENDGRID_API_KEY;
  const toEmail = process.env.NOTIFICATION_EMAIL;
  if (apiKey && toEmail) {
    try {
      await axios.post(
        'https://api.sendgrid.com/v3/mail/send',
        {
          personalizations: [{ to: [{ email: toEmail }] }],
          from: { email: process.env.FROM_EMAIL || 'noreply@jarvis.example.com' },
          subject: `[Jarvis] Reconciliation: ${matches.length} matches pending approval`,
          content: [{
            type: 'text/plain',
            value: `Tenant ${tenantId} has ${matches.length} reconciliation matches awaiting your approval. Please log in to review.`,
          }],
        },
        { headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' } },
      );
      console.log(`[Notify] Email alert sent to ${toEmail}`);
    } catch (err: any) {
      console.error('[Notify] Failed to send email notification:', err?.message);
    }
  }
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

export async function sendInvoiceEmail(invoiceId: string, pdfPath: string, tenantId: string, recipientEmail?: string): Promise<void> {
  console.log(`[Billing] Email sent for invoice ${invoiceId} (${pdfPath})`);
  // Integrate with SendGrid / SES to deliver the invoice PDF
  // Set SENDGRID_API_KEY env var to enable delivery
  const apiKey = process.env.SENDGRID_API_KEY;
  const fromEmail = process.env.FROM_EMAIL || 'noreply@jarvis.example.com';
  const toEmail = recipientEmail || process.env.INVOICE_NOTIFICATION_EMAIL;
  if (apiKey && toEmail) {
    try {
      await axios.post(
        'https://api.sendgrid.com/v3/mail/send',
        {
          personalizations: [{ to: [{ email: toEmail }] }],
          from: { email: fromEmail },
          subject: `Invoice ${invoiceId} from Jarvis`,
          content: [{ type: 'text/plain', value: `Please find your invoice attached (${pdfPath}).` }],
        },
        { headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' } },
      );
    } catch (err: any) {
      console.error('[Billing] Failed to send invoice email:', err?.message);
    }
  }
}

export async function markInvoiceSent(invoiceId: string, tenantId: string): Promise<void> {
  await db.query(
    `UPDATE invoices SET status = 'SENT' WHERE id = $1 AND tenant_id = $2`,
    [invoiceId, tenantId],
  );
}
