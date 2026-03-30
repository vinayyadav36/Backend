/**
 * Ledger Routes
 * Endpoints for the double-entry accounting ledger
 */

const express = require('express');
const { postEntry, getEntries, getBalances } = require('../controllers/ledgerController');
const { protect, authorize } = require('../middlewares/authMiddleware');
const tenantMiddleware = require('../middlewares/tenantMiddleware');

const router = express.Router();

// All ledger routes require authentication and tenant context
router.use(protect);
router.use(tenantMiddleware);

// Only admins and managers may post entries
router.post('/entries', authorize('manage_invoices'), postEntry);
router.get('/entries', authorize('view_reports', 'manage_invoices'), getEntries);
router.get('/balances', authorize('view_reports', 'manage_invoices'), getBalances);

module.exports = router;
