/**
 * Reconciliation Routes
 * Stateful Human-in-the-Loop workflow endpoints
 */

const express = require('express');
const {
  initiateWorkflow,
  listWorkflows,
  approveWorkflow,
  rejectWorkflow,
  commitWorkflow,
} = require('../controllers/reconcileController');
const { protect, authorize } = require('../middlewares/authMiddleware');
const tenantMiddleware = require('../middlewares/tenantMiddleware');

const router = express.Router();

router.use(protect);
router.use(tenantMiddleware);

// Any manager/admin can initiate and list
router.post('/', authorize('manage_invoices'), initiateWorkflow);
router.get('/', authorize('manage_invoices', 'view_reports'), listWorkflows);

// Only managers/admins can approve, reject, or commit
router.post('/:id/approve', authorize('manage_invoices'), approveWorkflow);
router.post('/:id/reject', authorize('manage_invoices'), rejectWorkflow);
router.post('/:id/commit', authorize('manage_invoices'), commitWorkflow);

module.exports = router;
