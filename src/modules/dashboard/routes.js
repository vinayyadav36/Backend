'use strict';
const express = require('express');
const router = express.Router();
const { protect } = require('../../middlewares/authMiddleware');
const ctrl = require('./controller');

router.get('/aggregated', protect, ctrl.getAggregatedDashboard);
router.get('/sales', protect, ctrl.getSalesData);
router.get('/revenue', protect, ctrl.getRevenueData);
router.get('/inventory', protect, ctrl.getInventoryData);
router.get('/hr', protect, ctrl.getHRData);
router.get('/marketing', protect, ctrl.getMarketingData);
router.get('/crm', protect, ctrl.getCRMData);
router.get('/trading', protect, ctrl.getTradingData);
router.get('/pos', protect, ctrl.getPOSData);
router.get('/university', protect, ctrl.getUniversityData);
router.get('/gst-summary', protect, ctrl.getGSTSummary);

router.post('/export/excel', protect, ctrl.exportToExcel);
router.post('/export/csv', protect, ctrl.exportToCSV);
router.get('/powerbi/embed', protect, ctrl.getPowerBIEmbedToken);

module.exports = router;