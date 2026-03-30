/**
 * PDF Routes (Express — Deliverable F)
 */
const express = require('express');
const { generateInvoice } = require('../controllers/pdfController');
const { protect } = require('../middlewares/authMiddleware');
const tenantMiddleware = require('../middlewares/tenantMiddleware');

const router = express.Router();

router.use(protect);
router.use(tenantMiddleware);

router.post('/invoice', generateInvoice);

module.exports = router;
