/**
 * Reconciliation Service
 * Stateful Human-in-the-Loop reconciliation workflow
 *
 * Workflow stages:
 *  1. initiate()        – create a workflow, run AI match, wait for manager approval
 *  2. approve() / reject() – manager decision
 *  3. commit()          – post balanced journal entry to ledger
 *
 * @version 1.0.0
 */

const Reconciliation = require('../models/Reconciliation');
const ledgerService = require('./ledgerService');
const logger = require('../config/logger');
const { sanitizeStatus } = require('../utils/sanitize');

/**
 * Naïve AI matcher – groups transactions by sign and pairs them.
 * Replace with a real ML call in production.
 *
 * @param {Array} transactions - Array of { accountId, amount, description }
 * @returns {Array} Proposed ledger lines [{ accountId, debit, credit }]
 */
const aiMatch = (transactions) => {
  const lines = transactions.map((t) => ({
    accountId: t.accountId,
    debit: t.amount > 0 ? Math.abs(t.amount) : 0,
    credit: t.amount < 0 ? Math.abs(t.amount) : 0,
    description: t.description,
  }));

  // Ensure balance: calculate net and add an offset line if needed
  const totalDebit = lines.reduce((s, l) => s + l.debit, 0);
  const totalCredit = lines.reduce((s, l) => s + l.credit, 0);
  const diff = parseFloat((totalDebit - totalCredit).toFixed(2));

  if (diff !== 0) {
    lines.push({
      accountId: diff > 0 ? 'SUSPENSE_CREDIT' : 'SUSPENSE_DEBIT',
      debit: diff < 0 ? Math.abs(diff) : 0,
      credit: diff > 0 ? diff : 0,
      description: 'Auto-balancing suspense entry',
    });
  }

  return lines;
};

/**
 * Step 1 – Initiate a reconciliation workflow.
 */
const initiate = async (tenantId, transactions, createdBy) => {
  const aiMatches = aiMatch(transactions);

  const workflow = await Reconciliation.create({
    tenantId,
    input: transactions,
    aiMatches,
    status: 'awaiting_approval',
    createdBy,
  });

  logger.info(`Reconciliation initiated: ${workflow._id} for tenant ${tenantId}`);
  return workflow;
};

/**
 * Step 2a – Manager approves the AI suggestion.
 */
const approve = async (tenantId, workflowId, managerId, note) => {
  const workflow = await Reconciliation.findOne({ _id: workflowId, tenantId });
  if (!workflow) throw Object.assign(new Error('Workflow not found'), { statusCode: 404 });
  if (workflow.status !== 'awaiting_approval') {
    throw Object.assign(new Error(`Cannot approve a workflow in "${workflow.status}" state`), {
      statusCode: 400,
    });
  }

  workflow.status = 'approved';
  workflow.reviewedBy = managerId;
  workflow.reviewedAt = new Date();
  workflow.reviewNote = note;
  await workflow.save();

  logger.info(`Reconciliation approved: ${workflowId} by ${managerId}`);
  return workflow;
};

/**
 * Step 2b – Manager rejects the AI suggestion.
 */
const reject = async (tenantId, workflowId, managerId, note) => {
  const workflow = await Reconciliation.findOne({ _id: workflowId, tenantId });
  if (!workflow) throw Object.assign(new Error('Workflow not found'), { statusCode: 404 });
  if (workflow.status !== 'awaiting_approval') {
    throw Object.assign(new Error(`Cannot reject a workflow in "${workflow.status}" state`), {
      statusCode: 400,
    });
  }

  workflow.status = 'rejected';
  workflow.reviewedBy = managerId;
  workflow.reviewedAt = new Date();
  workflow.reviewNote = note;
  await workflow.save();

  logger.info(`Reconciliation rejected: ${workflowId} by ${managerId}`);
  return workflow;
};

/**
 * Step 3 – Commit an approved workflow to the ledger.
 */
const commit = async (tenantId, workflowId, committedBy) => {
  const workflow = await Reconciliation.findOne({ _id: workflowId, tenantId });
  if (!workflow) throw Object.assign(new Error('Workflow not found'), { statusCode: 404 });
  if (workflow.status !== 'approved') {
    throw Object.assign(new Error('Only approved workflows can be committed'), { statusCode: 400 });
  }

  const entry = await ledgerService.postEntry(tenantId, workflow.aiMatches, {
    description: `Reconciliation commit: ${workflowId}`,
    referenceId: String(workflowId),
    referenceType: 'reconciliation',
    createdBy: committedBy,
  });

  workflow.status = 'committed';
  workflow.journalEntryId = entry._id;
  await workflow.save();

  logger.info(`Reconciliation committed: ${workflowId} -> journal entry ${entry._id}`);
  return { workflow, entry };
};

/**
 * List reconciliation workflows for a tenant.
 */
const list = async (tenantId, { status, page = 1, limit = 20 } = {}) => {
  const query = { tenantId };
  const safeStatus = sanitizeStatus(status, ['awaiting_approval', 'approved', 'rejected', 'committed']);
  if (safeStatus) query.status = safeStatus;

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const [workflows, total] = await Promise.all([
    Reconciliation.find(query).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)),
    Reconciliation.countDocuments(query),
  ]);

  return { workflows, total };
};

module.exports = { initiate, approve, reject, commit, list };
