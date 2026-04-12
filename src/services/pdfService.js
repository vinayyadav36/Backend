/**
 * PDF Service
 * Professional PDF generation using PDFKit (pure JS, no Chromium).
 * @version 2.0.0
 */

'use strict';

const PDFDocument = require('pdfkit');
const logger = require('../config/logger');

// ─── Design tokens ────────────────────────────────────────────────────────────
const COLOR_PRIMARY  = '#1E3A5F';
const COLOR_ACCENT   = '#2E86AB';
const COLOR_TEXT     = '#333333';
const COLOR_MUTED    = '#888888';
const COLOR_LIGHT_BG = '#F0F4F8';
const COLOR_WHITE    = '#FFFFFF';
const MARGIN         = 50;
const PAGE_WIDTH     = 595.28;   // A4 points
const CONTENT_WIDTH  = PAGE_WIDTH - MARGIN * 2;

// ─── Drawing helpers ─────────────────────────────────────────────────────────

function drawHRule(doc, y, color = '#DDDDDD') {
  doc.save().strokeColor(color).lineWidth(0.5)
    .moveTo(MARGIN, y).lineTo(PAGE_WIDTH - MARGIN, y)
    .stroke().restore();
}

function drawFilledRect(doc, x, y, w, h, color) {
  doc.save().rect(x, y, w, h).fill(color).restore();
}

function headerBanner(doc, title) {
  drawFilledRect(doc, 0, 0, PAGE_WIDTH, 80, COLOR_PRIMARY);
  doc.fillColor(COLOR_WHITE).fontSize(22).font('Helvetica-Bold')
    .text(title, MARGIN, 28, { width: CONTENT_WIDTH, align: 'center' });
  doc.moveDown(0);
  doc.y = 100;
}

function sectionTitle(doc, text) {
  doc.moveDown(0.5);
  doc.fillColor(COLOR_PRIMARY).fontSize(12).font('Helvetica-Bold').text(text);
  drawHRule(doc, doc.y + 2, COLOR_ACCENT);
  doc.moveDown(0.5);
}

function keyValue(doc, label, value, opts = {}) {
  const labelWidth = opts.labelWidth || 180;
  const y = doc.y;
  doc.fillColor(COLOR_MUTED).fontSize(9).font('Helvetica').text(label, MARGIN, y, { width: labelWidth, continued: false });
  doc.fillColor(COLOR_TEXT).fontSize(9).font('Helvetica').text(String(value ?? 'N/A'), MARGIN + labelWidth, y, { width: CONTENT_WIDTH - labelWidth });
}

function tableHeader(doc, columns, y) {
  const rowH = 20;
  drawFilledRect(doc, MARGIN, y, CONTENT_WIDTH, rowH, COLOR_PRIMARY);
  let x = MARGIN;
  columns.forEach(col => {
    doc.fillColor(COLOR_WHITE).fontSize(9).font('Helvetica-Bold')
      .text(col.label, x + 4, y + 5, { width: col.width - 8, align: col.align || 'left' });
    x += col.width;
  });
  return y + rowH;
}

function tableRow(doc, columns, values, y, shade) {
  const rowH = 18;
  if (shade) drawFilledRect(doc, MARGIN, y, CONTENT_WIDTH, rowH, COLOR_LIGHT_BG);
  let x = MARGIN;
  columns.forEach((col, i) => {
    doc.fillColor(COLOR_TEXT).fontSize(8.5).font('Helvetica')
      .text(String(values[i] ?? ''), x + 4, y + 4, { width: col.width - 8, align: col.align || 'left' });
    x += col.width;
  });
  drawHRule(doc, y + rowH, '#EEEEEE');
  return y + rowH;
}

function pageFooter(doc, pageNum, totalPages) {
  const footerY = doc.page.height - 40;
  drawHRule(doc, footerY - 4, '#CCCCCC');
  doc.fillColor(COLOR_MUTED).fontSize(8).font('Helvetica')
    .text(
      `${process.env.HOTEL_NAME || 'Hotel Management System'} | Generated ${new Date().toLocaleString('en-IN')}`,
      MARGIN, footerY, { width: CONTENT_WIDTH - 80, align: 'left' }
    )
    .text(`Page ${pageNum} of ${totalPages}`, MARGIN, footerY, { width: CONTENT_WIDTH, align: 'right' });
}

function buildPdf(builderFn) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: MARGIN, size: 'A4', autoFirstPage: true });
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    try {
      builderFn(doc);
    } catch (err) {
      reject(err);
    }
    doc.end();
  });
}

// ─── generateInvoicePdf ───────────────────────────────────────────────────────

/**
 * Generate a professional hotel invoice PDF.
 * @param {object} invoice - Invoice document (populated)
 * @param {object} [booking] - Linked booking (optional, may be embedded in invoice)
 * @param {object} [guest]   - Guest object (optional)
 * @param {object} [room]    - Room object (optional)
 * @returns {Promise<Buffer>}
 */
const generateInvoicePdf = (invoice, booking, guest, room) => {
  // Support both single-arg (old API) and multi-arg (new API)
  if (!booking && invoice && invoice.booking && typeof invoice.booking === 'object') {
    booking = invoice.booking;
  }
  if (!guest && invoice && invoice.guest && typeof invoice.guest === 'object') {
    guest = invoice.guest;
  }

  return buildPdf((doc) => {
    // ── Header banner ──────────────────────────────────────────────────────
    headerBanner(doc, `${process.env.HOTEL_NAME || 'Hotel Management System'}`);
    doc.fillColor(COLOR_MUTED).fontSize(11).font('Helvetica')
      .text('TAX INVOICE', MARGIN, doc.y, { width: CONTENT_WIDTH, align: 'center' });
    doc.moveDown(1);

    // ── Invoice meta block ─────────────────────────────────────────────────
    const metaY = doc.y;
    // Left column
    doc.fillColor(COLOR_TEXT).fontSize(9).font('Helvetica-Bold').text('Invoice Details', MARGIN, metaY);
    doc.font('Helvetica');
    keyValue(doc, 'Invoice No:', invoice.invoiceNumber || invoice._id || 'N/A');
    keyValue(doc, 'Issue Date:', invoice.createdAt ? new Date(invoice.createdAt).toLocaleDateString('en-IN') : new Date().toLocaleDateString('en-IN'));
    keyValue(doc, 'Status:', (invoice.status || 'pending').toUpperCase());

    // Right column — guest details
    const rightX = MARGIN + CONTENT_WIDTH / 2;
    doc.fillColor(COLOR_TEXT).fontSize(9).font('Helvetica-Bold').text('Billed To:', rightX, metaY);
    doc.font('Helvetica').fillColor(COLOR_TEXT).fontSize(9)
      .text(guest?.name || 'N/A', rightX, doc.y)
      .text(guest?.email || '', rightX)
      .text(guest?.phone || '', rightX)
      .text(guest?.address?.full || guest?.address?.city || '', rightX);

    doc.moveDown(1);
    drawHRule(doc, doc.y);
    doc.moveDown(0.5);

    // ── Booking info ───────────────────────────────────────────────────────
    if (booking || room) {
      sectionTitle(doc, 'Booking Details');
      keyValue(doc, 'Booking Ref:', booking?.bookingNumber || booking?._id || 'N/A');
      const ci = booking?.checkInDate ? new Date(booking.checkInDate).toLocaleDateString('en-IN') : 'N/A';
      const co = booking?.checkOutDate ? new Date(booking.checkOutDate).toLocaleDateString('en-IN') : 'N/A';
      keyValue(doc, 'Check-In:', ci);
      keyValue(doc, 'Check-Out:', co);
      if (room) {
        keyValue(doc, 'Room No:', room.number || 'N/A');
        keyValue(doc, 'Room Type:', room.type || 'N/A');
      }
      doc.moveDown(0.5);
    }

    // ── Line items table ───────────────────────────────────────────────────
    sectionTitle(doc, 'Items');
    const cols = [
      { label: '#',           width: 25,  align: 'center' },
      { label: 'Description', width: 200 },
      { label: 'Qty',         width: 40,  align: 'center' },
      { label: 'Rate (₹)',    width: 85,  align: 'right' },
      { label: 'Amount (₹)',  width: 95,  align: 'right' },
    ];
    const totalColsWidth = cols.reduce((s, c) => s + c.width, 0);
    // adjust last column to fill
    cols[cols.length - 1].width += CONTENT_WIDTH - totalColsWidth;

    let rowY = tableHeader(doc, cols, doc.y);

    const items = Array.isArray(invoice.items) ? invoice.items : [];
    items.forEach((item, idx) => {
      const amount = (item.amount != null)
        ? item.amount
        : ((item.quantity || 1) * (item.rate || 0));
      rowY = tableRow(doc, cols, [
        idx + 1,
        item.description || 'Service',
        item.quantity || 1,
        Number(item.rate || 0).toFixed(2),
        Number(amount).toFixed(2),
      ], rowY, idx % 2 === 1);

      // Page break protection
      if (rowY > doc.page.height - 140) {
        doc.addPage();
        rowY = MARGIN;
        rowY = tableHeader(doc, cols, rowY);
      }
    });

    doc.y = rowY + 4;
    doc.moveDown(0.5);

    // ── Totals ─────────────────────────────────────────────────────────────
    const totalsX = MARGIN + CONTENT_WIDTH * 0.55;
    const totalsW = CONTENT_WIDTH * 0.45;

    const subtotal      = Number(invoice.subtotal || 0);
    const discountAmt   = Number(invoice.discountAmount || 0);
    const taxRate       = Number(invoice.taxRate || 0);
    const taxAmount     = Number(invoice.taxAmount || 0);
    const totalAmount   = Number(invoice.totalAmount || 0);
    const paidAmount    = Number(invoice.paidAmount || 0);
    const balanceDue    = Math.max(0, totalAmount - paidAmount);

    const totalsRows = [
      ['Subtotal', `₹${subtotal.toFixed(2)}`],
      ...(discountAmt > 0 ? [[`Discount`, `-₹${discountAmt.toFixed(2)}`]] : []),
      ...(taxRate > 0     ? [[`GST / Tax (${taxRate}%)`, `₹${taxAmount.toFixed(2)}`]] : []),
      ['TOTAL', `₹${totalAmount.toFixed(2)}`],
      ['Paid', `₹${paidAmount.toFixed(2)}`],
      ['Balance Due', `₹${balanceDue.toFixed(2)}`],
    ];

    let ty = doc.y;
    totalsRows.forEach(([label, value], i) => {
      const isTotal = label === 'TOTAL';
      const isDue   = label === 'Balance Due';
      if (isTotal) drawHRule(doc, ty, COLOR_PRIMARY);
      const bg = isDue ? '#FFF3CD' : isTotal ? COLOR_LIGHT_BG : null;
      if (bg) drawFilledRect(doc, totalsX - 4, ty, totalsW + 8, 18, bg);
      doc.fillColor(isTotal || isDue ? COLOR_PRIMARY : COLOR_TEXT)
        .fontSize(isTotal || isDue ? 10 : 9)
        .font(isTotal || isDue ? 'Helvetica-Bold' : 'Helvetica')
        .text(label, totalsX, ty + 4, { width: totalsW * 0.55 })
        .text(value, totalsX, ty + 4, { width: totalsW, align: 'right' });
      ty += 18;
    });

    // ── Payment info ───────────────────────────────────────────────────────
    doc.y = ty + 8;
    if (invoice.paymentMethod) {
      doc.fillColor(COLOR_MUTED).fontSize(8.5).font('Helvetica')
        .text(`Payment Method: ${invoice.paymentMethod}`, MARGIN, ty + 8);
    }

    // ── Footer note ────────────────────────────────────────────────────────
    doc.moveDown(2);
    drawHRule(doc, doc.y, COLOR_ACCENT);
    doc.moveDown(0.5);
    doc.fillColor(COLOR_MUTED).fontSize(8).font('Helvetica-Oblique')
      .text('Thank you for choosing us. For any queries, please contact our front desk.', MARGIN, doc.y, {
        width: CONTENT_WIDTH, align: 'center'
      });

    pageFooter(doc, 1, 1);
  });
};

// ─── generateReport ───────────────────────────────────────────────────────────

/**
 * Generate a professional summary report PDF.
 * @param {object} reportData
 *   {
 *     title?: string,
 *     period?: string,
 *     summary?: { [label]: value },
 *     sections?: [{ title, rows: [[col1, col2, ...]], headers: [string] }]
 *   }
 * @param {string} [title]
 * @returns {Promise<Buffer>}
 */
const generateReport = (reportData, title) => {
  const reportTitle = title || reportData?.title || 'Hotel Report';

  return buildPdf((doc) => {
    // ── Header ─────────────────────────────────────────────────────────────
    headerBanner(doc, reportTitle);
    if (reportData?.period) {
      doc.fillColor(COLOR_MUTED).fontSize(10).font('Helvetica')
        .text(`Period: ${reportData.period}`, MARGIN, doc.y, { width: CONTENT_WIDTH, align: 'center' });
    }
    doc.fillColor(COLOR_MUTED).fontSize(9).font('Helvetica')
      .text(`Generated: ${new Date().toLocaleString('en-IN')}`, MARGIN, doc.y, { width: CONTENT_WIDTH, align: 'center' });
    doc.moveDown(1);

    // ── Summary KPIs ───────────────────────────────────────────────────────
    if (reportData?.summary && Object.keys(reportData.summary).length > 0) {
      sectionTitle(doc, 'Summary');
      const entries = Object.entries(reportData.summary);
      const boxW = Math.floor(CONTENT_WIDTH / 3) - 6;
      const boxH = 50;
      const startX = MARGIN;
      let bx = startX, by = doc.y;

      entries.forEach(([label, value], idx) => {
        drawFilledRect(doc, bx, by, boxW, boxH, COLOR_LIGHT_BG);
        doc.save().rect(bx, by, boxW, boxH).stroke(COLOR_ACCENT).restore();
        doc.fillColor(COLOR_PRIMARY).fontSize(16).font('Helvetica-Bold')
          .text(String(value), bx + 6, by + 8, { width: boxW - 12, align: 'center' });
        doc.fillColor(COLOR_MUTED).fontSize(8).font('Helvetica')
          .text(label, bx + 6, by + 30, { width: boxW - 12, align: 'center' });
        bx += boxW + 9;
        if ((idx + 1) % 3 === 0) {
          bx = startX;
          by += boxH + 8;
        }
      });
      doc.y = by + (entries.length % 3 !== 0 ? boxH + 8 : 0) + 4;
      doc.moveDown(0.5);
    }

    // ── Data sections ──────────────────────────────────────────────────────
    const sections = reportData?.sections || [];
    sections.forEach(section => {
      if (doc.y > doc.page.height - 160) doc.addPage();
      sectionTitle(doc, section.title || 'Data');

      if (!Array.isArray(section.rows) || section.rows.length === 0) {
        doc.fillColor(COLOR_MUTED).fontSize(9).font('Helvetica-Oblique')
          .text('No data available for this section.', MARGIN, doc.y);
        doc.moveDown(0.5);
        return;
      }

      const headers = section.headers || Object.keys(section.rows[0] || {});
      const colW = Math.floor(CONTENT_WIDTH / Math.max(headers.length, 1));
      const cols = headers.map(h => ({ label: String(h), width: colW }));
      // Give last column remainder
      if (cols.length > 0) cols[cols.length - 1].width += CONTENT_WIDTH - colW * cols.length;

      let rowY = tableHeader(doc, cols, doc.y);

      section.rows.forEach((row, idx) => {
        const values = Array.isArray(row)
          ? row
          : headers.map(h => row[h]);
        rowY = tableRow(doc, cols, values, rowY, idx % 2 === 1);
        if (rowY > doc.page.height - 100) {
          doc.addPage();
          rowY = MARGIN;
          rowY = tableHeader(doc, cols, rowY);
        }
      });

      doc.y = rowY + 6;
      doc.moveDown(0.5);
    });

    // ── Raw data table fallback ────────────────────────────────────────────
    if (sections.length === 0 && Array.isArray(reportData?.data) && reportData.data.length > 0) {
      sectionTitle(doc, 'Data');
      const headers = Object.keys(reportData.data[0]);
      const colW = Math.floor(CONTENT_WIDTH / Math.max(headers.length, 1));
      const cols = headers.map(h => ({ label: h, width: colW }));
      if (cols.length > 0) cols[cols.length - 1].width += CONTENT_WIDTH - colW * cols.length;
      let rowY = tableHeader(doc, cols, doc.y);
      reportData.data.forEach((row, idx) => {
        rowY = tableRow(doc, cols, headers.map(h => row[h]), rowY, idx % 2 === 1);
        if (rowY > doc.page.height - 100) {
          doc.addPage();
          rowY = MARGIN;
          rowY = tableHeader(doc, cols, rowY);
        }
      });
      doc.y = rowY + 6;
    }

    // ── Footer ─────────────────────────────────────────────────────────────
    doc.moveDown(1);
    drawHRule(doc, doc.y, COLOR_ACCENT);
    doc.moveDown(0.5);
    doc.fillColor(COLOR_MUTED).fontSize(8).font('Helvetica-Oblique')
      .text('This is an automatically generated report. For queries, contact the management.', MARGIN, doc.y, {
        width: CONTENT_WIDTH, align: 'center'
      });

    pageFooter(doc, 1, 1);
  });
};

module.exports = {
  generateInvoicePdf,
  generateReport,
};
