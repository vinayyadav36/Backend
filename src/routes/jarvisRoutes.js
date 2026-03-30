/**
 * JARVIS Routes
 * AI-powered forecasting and anomaly detection
 */

const express = require('express');
const { forecast, detectAnomaly } = require('../controllers/jarvisController');
const { protect, authorize } = require('../middlewares/authMiddleware');
const tenantMiddleware = require('../middlewares/tenantMiddleware');

const router = express.Router();

router.use(protect);
router.use(tenantMiddleware);

router.post('/forecast', authorize('view_analytics', 'view_reports'), forecast);
router.post('/anomaly', authorize('view_analytics', 'manage_invoices'), detectAnomaly);

module.exports = router;
