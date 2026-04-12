/**
 * Excel Service
 * Generates Excel workbooks from data arrays using ExcelJS.
 * @version 2.0.0
 */

'use strict';

const ExcelJS = require('exceljs');

// ─── Design helpers ───────────────────────────────────────────────────────────

const PRIMARY_COLOR = '1E3A5F';
const ACCENT_COLOR  = '2E86AB';
const LIGHT_BG      = 'F0F4F8';

function applyHeaderStyle(row) {
  row.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${PRIMARY_COLOR}` } };
  row.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  row.height = 22;
}

function applyDataStyle(row, isEven) {
  row.fill = isEven
    ? { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${LIGHT_BG}` } }
    : { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
  row.alignment = { vertical: 'middle' };
  row.height = 18;
}

function applyBorder(row, colCount) {
  for (let c = 1; c <= colCount; c++) {
    const cell = row.getCell(c);
    cell.border = {
      top:    { style: 'thin', color: { argb: 'FFDDDDDD' } },
      bottom: { style: 'thin', color: { argb: 'FFDDDDDD' } },
      left:   { style: 'thin', color: { argb: 'FFDDDDDD' } },
      right:  { style: 'thin', color: { argb: 'FFDDDDDD' } },
    };
  }
}

function addSheetTitle(worksheet, title, colSpan) {
  const titleRow = worksheet.addRow([title]);
  titleRow.height = 30;
  titleRow.font = { bold: true, size: 14, color: { argb: `FF${PRIMARY_COLOR}` } };
  titleRow.alignment = { vertical: 'middle', horizontal: 'left' };
  worksheet.mergeCells(titleRow.number, 1, titleRow.number, colSpan);

  const subRow = worksheet.addRow([`Generated: ${new Date().toLocaleString('en-IN')}`]);
  subRow.font = { size: 9, color: { argb: 'FF888888' }, italic: true };
  worksheet.addRow([]); // blank spacer
}

function createWorkbook(creator = 'Hotel Management System') {
  const wb = new ExcelJS.Workbook();
  wb.creator = creator;
  wb.created = new Date();
  wb.modified = new Date();
  return wb;
}

// ─── toBuffer ─────────────────────────────────────────────────────────────────

/**
 * Build an in-memory Excel workbook from an array of objects.
 * @param {Array}  data
 * @param {string} sheetName
 * @returns {Promise<Buffer>}
 */
const toBuffer = async (data, sheetName = 'Report') => {
  const workbook = createWorkbook();
  const worksheet = workbook.addWorksheet(sheetName);

  if (!data || data.length === 0) {
    worksheet.addRow(['No data available']);
    return workbook.xlsx.writeBuffer();
  }

  const columns = Object.keys(data[0]).map((key) => ({
    header: key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    key,
    width: 20,
  }));
  worksheet.columns = columns;

  applyHeaderStyle(worksheet.getRow(1));

  data.forEach((row, idx) => {
    const dataRow = worksheet.addRow(row);
    applyDataStyle(dataRow, idx % 2 === 1);
    applyBorder(dataRow, columns.length);
  });

  // Auto-fit columns
  worksheet.columns.forEach(col => {
    let maxLen = col.header ? col.header.length : 10;
    col.eachCell({ includeEmpty: false }, cell => {
      const len = cell.value ? String(cell.value).length : 0;
      if (len > maxLen) maxLen = len;
    });
    col.width = Math.min(maxLen + 4, 50);
  });

  return workbook.xlsx.writeBuffer();
};

// ─── exportBookings ───────────────────────────────────────────────────────────

/**
 * Export bookings to Excel.
 * @param {Array} bookings
 * @returns {Promise<Buffer>}
 */
const exportBookings = async (bookings) => {
  const workbook = createWorkbook();
  const ws = workbook.addWorksheet('Bookings');

  const columns = [
    { header: 'Booking #',    key: 'bookingNumber', width: 20 },
    { header: 'Guest Name',   key: 'guestName',     width: 24 },
    { header: 'Guest Email',  key: 'guestEmail',    width: 28 },
    { header: 'Room No.',     key: 'roomNumber',    width: 12 },
    { header: 'Room Type',    key: 'roomType',      width: 14 },
    { header: 'Check-In',     key: 'checkIn',       width: 16 },
    { header: 'Check-Out',    key: 'checkOut',      width: 16 },
    { header: 'Nights',       key: 'nights',        width: 10 },
    { header: 'Status',       key: 'status',        width: 14 },
    { header: 'Source',       key: 'source',        width: 14 },
    { header: 'Total (₹)',    key: 'totalAmount',   width: 14 },
    { header: 'Paid (₹)',     key: 'paidAmount',    width: 14 },
    { header: 'Payment',      key: 'paymentStatus', width: 14 },
    { header: 'Created At',   key: 'createdAt',     width: 20 },
  ];

  ws.columns = columns;
  addSheetTitle(ws, 'Bookings Export', columns.length);
  ws.spliceRows(ws.lastRow.number + 1, 0); // insert blank
  const headerRow = ws.addRow(columns.map(c => c.header));
  applyHeaderStyle(headerRow);

  (bookings || []).forEach((b, idx) => {
    const guest = b.guest || {};
    const room  = b.room  || {};
    const ci    = b.checkInDate  ? new Date(b.checkInDate)  : null;
    const co    = b.checkOutDate ? new Date(b.checkOutDate) : null;
    const nights = ci && co ? Math.ceil((co - ci) / 86400000) : 0;

    const row = ws.addRow({
      bookingNumber: b.bookingNumber || String(b._id || ''),
      guestName:     guest.name  || (typeof b.guest === 'string' ? b.guest : 'N/A'),
      guestEmail:    guest.email || '',
      roomNumber:    room.number || (typeof b.room === 'string' ? b.room : 'N/A'),
      roomType:      room.type   || '',
      checkIn:       ci ? ci.toLocaleDateString('en-IN') : '',
      checkOut:      co ? co.toLocaleDateString('en-IN') : '',
      nights,
      status:        b.status        || '',
      source:        b.source        || '',
      totalAmount:   b.totalAmount   != null ? Number(b.totalAmount)   : 0,
      paidAmount:    b.paidAmount    != null ? Number(b.paidAmount)    : 0,
      paymentStatus: b.paymentStatus || '',
      createdAt:     b.createdAt     ? new Date(b.createdAt).toLocaleString('en-IN') : '',
    });
    applyDataStyle(row, idx % 2 === 1);
    applyBorder(row, columns.length);
  });

  // Currency formatting
  ['totalAmount', 'paidAmount'].forEach(key => {
    const col = ws.getColumn(key);
    col.numFmt = '₹#,##0.00';
  });

  return workbook.xlsx.writeBuffer();
};

// ─── exportGuests ─────────────────────────────────────────────────────────────

/**
 * Export guests to Excel.
 * @param {Array} guests
 * @returns {Promise<Buffer>}
 */
const exportGuests = async (guests) => {
  const workbook = createWorkbook();
  const ws = workbook.addWorksheet('Guests');

  const columns = [
    { header: '#',              key: 'seq',           width: 6  },
    { header: 'Name',           key: 'name',          width: 24 },
    { header: 'Email',          key: 'email',         width: 28 },
    { header: 'Phone',          key: 'phone',         width: 18 },
    { header: 'Nationality',    key: 'nationality',   width: 16 },
    { header: 'VIP Status',     key: 'vipStatus',     width: 14 },
    { header: 'Total Stays',    key: 'totalBookings', width: 14 },
    { header: 'Total Spent (₹)',key: 'totalSpent',    width: 18 },
    { header: 'Loyalty Points', key: 'loyaltyPoints', width: 16 },
    { header: 'Last Visit',     key: 'lastVisit',     width: 18 },
    { header: 'Created At',     key: 'createdAt',     width: 20 },
  ];

  ws.columns = columns;
  addSheetTitle(ws, 'Guests Export', columns.length);
  const headerRow = ws.addRow(columns.map(c => c.header));
  applyHeaderStyle(headerRow);

  (guests || []).forEach((g, idx) => {
    const row = ws.addRow({
      seq:           idx + 1,
      name:          g.name          || 'N/A',
      email:         g.email         || '',
      phone:         g.phone         || '',
      nationality:   g.nationality   || 'Indian',
      vipStatus:     g.vipStatus     || 'regular',
      totalBookings: g.totalBookings != null ? Number(g.totalBookings) : 0,
      totalSpent:    g.totalSpent    != null ? Number(g.totalSpent)    : 0,
      loyaltyPoints: g.loyaltyPoints != null ? Number(g.loyaltyPoints) : 0,
      lastVisit:     g.lastVisit     ? new Date(g.lastVisit).toLocaleDateString('en-IN') : '',
      createdAt:     g.createdAt     ? new Date(g.createdAt).toLocaleString('en-IN')     : '',
    });
    applyDataStyle(row, idx % 2 === 1);
    applyBorder(row, columns.length);
  });

  ws.getColumn('totalSpent').numFmt = '₹#,##0.00';

  return workbook.xlsx.writeBuffer();
};

// ─── exportReport ─────────────────────────────────────────────────────────────

/**
 * Export generic report data to Excel.
 * reportData: { title?, sheets?: [{ name, headers, rows }], data?, summary? }
 * @param {object} reportData
 * @returns {Promise<Buffer>}
 */
const exportReport = async (reportData) => {
  const workbook = createWorkbook();
  const title    = reportData?.title || 'Report';

  // ── Summary sheet ──────────────────────────────────────────────────────
  if (reportData?.summary && Object.keys(reportData.summary).length > 0) {
    const summaryWs = workbook.addWorksheet('Summary');
    summaryWs.columns = [
      { header: 'Metric', key: 'metric', width: 30 },
      { header: 'Value',  key: 'value',  width: 24 },
    ];
    addSheetTitle(summaryWs, `${title} — Summary`, 2);
    const hdr = summaryWs.addRow(['Metric', 'Value']);
    applyHeaderStyle(hdr);

    Object.entries(reportData.summary).forEach(([k, v], idx) => {
      const row = summaryWs.addRow({ metric: k, value: v });
      applyDataStyle(row, idx % 2 === 1);
      applyBorder(row, 2);
    });
  }

  // ── Named sheets ───────────────────────────────────────────────────────
  const sheets = reportData?.sheets || [];
  sheets.forEach(sheet => {
    const ws = workbook.addWorksheet(sheet.name || 'Sheet');
    const headers = sheet.headers || (sheet.rows && sheet.rows.length > 0 ? Object.keys(sheet.rows[0]) : []);
    if (headers.length === 0) { ws.addRow(['No data']); return; }

    ws.columns = headers.map(h => ({ header: h, key: h, width: 20 }));
    addSheetTitle(ws, sheet.name || title, headers.length);
    const hdr = ws.addRow(headers);
    applyHeaderStyle(hdr);

    (sheet.rows || []).forEach((row, idx) => {
      const values = Array.isArray(row) ? row : headers.map(h => row[h]);
      const dataRow = ws.addRow(values);
      applyDataStyle(dataRow, idx % 2 === 1);
      applyBorder(dataRow, headers.length);
    });
  });

  // ── Fallback: flat data array ───────────────────────────────────────────
  if (sheets.length === 0 && !reportData?.summary) {
    const ws = workbook.addWorksheet('Data');
    const data = reportData?.data || (Array.isArray(reportData) ? reportData : []);
    if (data.length === 0) {
      ws.addRow(['No data available']);
    } else {
      const headers = Object.keys(data[0]);
      ws.columns = headers.map(h => ({ header: h, key: h, width: 20 }));
      addSheetTitle(ws, title, headers.length);
      const hdr = ws.addRow(headers);
      applyHeaderStyle(hdr);
      data.forEach((row, idx) => {
        const dr = ws.addRow(headers.map(h => row[h]));
        applyDataStyle(dr, idx % 2 === 1);
        applyBorder(dr, headers.length);
      });
    }
  }

  return workbook.xlsx.writeBuffer();
};

module.exports = {
  toBuffer,
  exportBookings,
  exportGuests,
  exportReport,
};
