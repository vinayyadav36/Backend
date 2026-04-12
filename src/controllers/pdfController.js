/**
 * PDF Controller
 * Generates PDF documents for invoices and reports.
 * @version 2.0.0
 */
const { generateInvoicePdf, generateReport: generateReportPdf } = require('../services/pdfService');
const logger = require('../config/logger');

/**
 * POST /api/v1/pdf/invoice
 * Generate and stream a hotel invoice PDF.
 */
const generateInvoice = async (req, res) => {
  try {
    const data = req.body;

    if (!data || typeof data !== 'object') {
      return res.status(400).json({ success: false, message: 'Invoice data required.' });
    }

    const buffer = await generateInvoicePdf(data);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="invoice-${data.invoiceNumber || Date.now()}.pdf"`,
    );
    res.send(buffer);
  } catch (err) {
    logger.error('PDF invoice generation error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * POST /api/v1/pdf/report
 * Generate and stream a hotel report PDF.
 * Body: { title?, period?, summary?, sections?, data? }
 */
const generateReport = async (req, res) => {
  try {
    const reportData = req.body;
    const title = reportData?.title || req.query.title || 'Hotel Report';

    if (!reportData || typeof reportData !== 'object') {
      return res.status(400).json({ success: false, message: 'Report data required.' });
    }

    const buffer = await generateReportPdf(reportData, title);

    const safeName = title.replace(/[^a-z0-9_-]/gi, '_').toLowerCase();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${safeName}-${Date.now()}.pdf"`,
    );
    res.send(buffer);
  } catch (err) {
    logger.error('PDF report generation error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { generateInvoice, generateReport };
