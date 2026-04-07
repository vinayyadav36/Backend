/**
 * PDF Service (Express — Deliverable F)
 * Generates GST-compliant PDF invoices using PDFKit (pure JS, no Chromium).
 */
const PDFDocument = require('pdfkit');
const _logger = require('../config/logger');

/**
 * Generate a GST invoice PDF buffer.
 * @param {object} data  Invoice data
 * @returns {Promise<Buffer>}
 */
const generateInvoicePdf = (data) =>
  new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // ── Header ──────────────────────────────────────────────────────────────
    doc
      .fontSize(22)
      .fillColor('#1E3A5F')
      .text('GST INVOICE', { align: 'center' })
      .moveDown(0.5);

    doc
      .fontSize(10)
      .fillColor('#444')
      .text(`Invoice No : ${data.invoiceNumber || 'N/A'}`)
      .text(`Customer   : ${data.customerId || data.customerName || 'N/A'}`)
      .text(`Issue Date : ${data.issueDate || new Date().toISOString().split('T')[0]}`)
      .text(`Due Date   : ${data.dueDate || 'N/A'}`)
      .moveDown();

    // ── Line Items ───────────────────────────────────────────────────────────
    doc.fontSize(11).fillColor('#1E3A5F').text('Line Items', { underline: true }).moveDown(0.3);
    doc.fontSize(10).fillColor('#333');

    const items = Array.isArray(data.lineItems) ? data.lineItems : [];
    items.forEach((item) => {
      const name = item.name || item.description || 'Item';
      const qty = item.qty ?? item.quantity ?? 1;
      const rate = item.price ?? item.rate ?? 0;
      doc.text(`  • ${name}  ×${qty}  @  ₹${rate}`);
    });

    doc.moveDown();

    // ── Totals ───────────────────────────────────────────────────────────────
    doc
      .fontSize(11)
      .fillColor('#333')
      .text(`Subtotal      : ₹${data.subtotal ?? 0}`)
      .text(`GST Total     : ₹${data.taxTotal ?? 0}`)
      .fontSize(13)
      .fillColor('#1E3A5F')
      .text(`Grand Total   : ₹${data.total ?? 0}`, { bold: true });

    doc.end();
  });

module.exports = { generateInvoicePdf };
