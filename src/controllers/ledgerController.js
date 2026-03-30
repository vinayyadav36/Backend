/**
 * Ledger Controller
 * REST handlers for the double-entry accounting ledger
 * @version 1.0.0
 */

const ledgerService = require('../services/ledgerService');
const logger = require('../config/logger');

/**
 * POST /api/v1/ledger/entries
 * Post a balanced journal entry
 */
const postEntry = async (req, res) => {
  try {
    const { lines, description, referenceId, referenceType } = req.body;

    if (!Array.isArray(lines) || lines.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Provide at least two ledger lines.',
      });
    }

    const entry = await ledgerService.postEntry(req.tenantId, lines, {
      description,
      referenceId,
      referenceType,
      createdBy: req.user?.id,
    });

    res.status(201).json({ success: true, data: entry });
  } catch (err) {
    logger.error('postEntry error:', err.message);
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/v1/ledger/entries
 * List journal entries for the tenant (paginated)
 */
const getEntries = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const result = await ledgerService.getEntries(req.tenantId, { page, limit });
    res.json({ success: true, ...result });
  } catch (err) {
    logger.error('getEntries error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/v1/ledger/balances
 * Get account balances for the tenant
 */
const getBalances = async (req, res) => {
  try {
    const balances = await ledgerService.getBalances(req.tenantId);
    res.json({ success: true, data: balances });
  } catch (err) {
    logger.error('getBalances error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { postEntry, getEntries, getBalances };
