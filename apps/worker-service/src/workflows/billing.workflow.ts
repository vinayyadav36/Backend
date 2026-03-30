// apps/worker-service/src/workflows/billing.workflow.ts
import { proxyActivities, log } from '@temporalio/workflow';
import type * as activities from '../activities';

const { generateInvoicePdf, sendInvoiceEmail, markInvoiceSent } =
  proxyActivities<typeof activities>({ startToCloseTimeout: '2 minutes' });

/**
 * Billing / Invoice Dispatch Workflow
 * 1. Generate PDF invoice
 * 2. Send via email
 * 3. Mark invoice as SENT in DB
 */
export async function billingWorkflow(invoiceId: string, tenantId: string): Promise<string> {
  log.info('Starting billing workflow', { invoiceId, tenantId });

  const pdfPath = await generateInvoicePdf(invoiceId, tenantId);
  await sendInvoiceEmail(invoiceId, pdfPath, tenantId);
  await markInvoiceSent(invoiceId, tenantId);

  log.info('Invoice dispatched', { invoiceId });
  return `Invoice ${invoiceId} dispatched successfully`;
}
