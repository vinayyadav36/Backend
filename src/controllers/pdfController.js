/**
 * PDF Controller (Express — Deliverable F)
 */
const { generateInvoicePdf } = require('../services/pdfService');
const logger = require('../config/logger');

/**
 * POST /api/v1/pdf/invoice
 * Generate and stream a GST invoice PDF.
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
    logger.error('PDF generation error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { generateInvoice };
