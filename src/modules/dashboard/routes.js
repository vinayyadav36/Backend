'use strict';
const express = require('express');
const router = express.Router();
const { protect } = require('../../middlewares/authMiddleware');
const ctrl = require('./controller');

router.get('/aggregated', ctrl.getAggregatedDashboard);
router.get('/sales', ctrl.getSalesData);
router.get('/revenue', ctrl.getRevenueData);
router.get('/inventory', ctrl.getInventoryData);
router.get('/hr', ctrl.getHRData);
router.get('/marketing', ctrl.getMarketingData);
router.get('/crm', ctrl.getCRMData);
router.get('/trading', ctrl.getTradingData);
router.get('/pos', ctrl.getPOSData);
router.get('/university', ctrl.getUniversityData);
router.get('/gst-summary', ctrl.getGSTSummary);

router.post('/export/excel', ctrl.exportToExcel);
router.post('/export/csv', ctrl.exportToCSV);
router.get('/powerbi/embed', ctrl.getPowerBIEmbedToken);

module.exports = router;