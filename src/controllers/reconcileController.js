/**
 * Reconciliation Controller
 * Human-in-the-Loop stateful reconciliation workflow
 * @version 1.0.0
 */

const reconcileService = require('../services/reconcileService');
const logger = require('../config/logger');

/** POST /api/v1/reconcile – Initiate a new workflow */
const initiateWorkflow = async (req, res) => {
  try {
    const { transactions } = req.body;
    if (!Array.isArray(transactions) || transactions.length === 0) {
      return res.status(400).json({ success: false, message: 'Provide an array of transactions.' });
    }
    const workflow = await reconcileService.initiate(req.tenantId, transactions, req.user?.id);
    res.status(201).json({ success: true, data: workflow });
  } catch (err) {
    logger.error('initiateWorkflow error:', err.message);
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

/** GET /api/v1/reconcile – List workflows */
const listWorkflows = async (req, res) => {
  try {
    const { status, page, limit } = req.query;
    const result = await reconcileService.list(req.tenantId, { status, page, limit });
    res.json({ success: true, ...result });
  } catch (err) {
    logger.error('listWorkflows error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

/** POST /api/v1/reconcile/:id/approve – Manager approves */
const approveWorkflow = async (req, res) => {
  try {
    const { note } = req.body;
    const workflow = await reconcileService.approve(
      req.tenantId,
      req.params.id,
      req.user?.id,
      note
    );
    res.json({ success: true, data: workflow });
  } catch (err) {
    logger.error('approveWorkflow error:', err.message);
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

/** POST /api/v1/reconcile/:id/reject – Manager rejects */
const rejectWorkflow = async (req, res) => {
  try {
    const { note } = req.body;
    const workflow = await reconcileService.reject(
      req.tenantId,
      req.params.id,
      req.user?.id,
      note
    );
    res.json({ success: true, data: workflow });
  } catch (err) {
    logger.error('rejectWorkflow error:', err.message);
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

/** POST /api/v1/reconcile/:id/commit – Commit approved workflow to ledger */
const commitWorkflow = async (req, res) => {
  try {
    const result = await reconcileService.commit(req.tenantId, req.params.id, req.user?.id);
    res.json({ success: true, data: result });
  } catch (err) {
    logger.error('commitWorkflow error:', err.message);
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

module.exports = { initiateWorkflow, listWorkflows, approveWorkflow, rejectWorkflow, commitWorkflow };
