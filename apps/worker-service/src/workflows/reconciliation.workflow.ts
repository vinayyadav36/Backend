// apps/worker-service/src/workflows/reconciliation.workflow.ts
import { proxyActivities, defineSignal, condition, log } from '@temporalio/workflow';
import type * as activities from '../activities';

const { fetchBankStatements, matchInvoices, notifyManager, commitToLedger } =
  proxyActivities<typeof activities>({ startToCloseTimeout: '1 minute' });

/** Human-in-the-loop approval signal */
export const approveSignal = defineSignal<[boolean]>('approveReconciliation');

/**
 * Nightly Reconciliation Workflow
 * 1. Fetch bank statements from Postgres
 * 2. Call Python AI agent to find matches (saved to pending_tasks — NOT ledger)
 * 3. Notify manager via email/Socket
 * 4. Wait up to 24 h for human approval signal
 * 5. If approved → commit to Postgres ledger
 */
export async function nightlyReconciliationWorkflow(tenantId: string): Promise<string> {
  let isApproved = false;

  log.info('Starting nightly reconciliation', { tenantId });

  const data = await fetchBankStatements(tenantId);
  const matches = await matchInvoices(data);
  await notifyManager(tenantId, matches);

  // Sleep here — consumes ZERO CPU/RAM until signal arrives or timeout
  const signalReceived = await condition(() => isApproved, '24 hours');

  if (!signalReceived) {
    log.warn('Reconciliation timed out — no manager approval within 24h', { tenantId });
    return 'Reconciliation Timed Out';
  }

  if (isApproved) {
    const result = await commitToLedger(tenantId, matches);
    log.info('Reconciliation committed to ledger', { tenantId, result });
    return `Committed: ${result}`;
  }

  return 'Reconciliation Rejected by Manager';
}
