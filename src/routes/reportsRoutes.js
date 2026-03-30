/**
 * Reports Routes
 * Finance summary and export endpoints (Power BI / Excel)
 */

const express = require('express');
const { getFinanceSummary, exportFinanceExcel } = require('../controllers/reportsController');
const { protect, authorize } = require('../middlewares/authMiddleware');
const tenantMiddleware = require('../middlewares/tenantMiddleware');

const router = express.Router();

router.use(protect);
router.use(tenantMiddleware);

router.get('/finance/summary', authorize('view_reports', 'view_analytics'), getFinanceSummary);
router.get('/finance/export', authorize('view_reports', 'view_analytics'), exportFinanceExcel);

module.exports = router;
