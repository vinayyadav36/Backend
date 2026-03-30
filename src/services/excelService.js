/**
 * Excel Service
 * Generates Excel workbooks from data arrays using ExcelJS
 * @version 1.0.0
 */

const ExcelJS = require('exceljs');

/**
 * Build an in-memory Excel workbook from an array of objects.
 *
 * @param {Array}  data       - Array of plain objects (each object = one row)
 * @param {string} sheetName  - Name for the worksheet
 * @returns {Promise<Buffer>}  Excel file as a buffer
 */
const toBuffer = async (data, sheetName = 'Report') => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'JARVIS Hotel Management';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet(sheetName);

  if (!data || data.length === 0) {
    worksheet.addRow(['No data available']);
    return workbook.xlsx.writeBuffer();
  }

  // Auto-generate columns from the first row's keys
  const columns = Object.keys(data[0]).map((key) => ({
    header: key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    key,
    width: 20,
  }));
  worksheet.columns = columns;

  // Style the header row
  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1E3A5F' },
  };
  worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

  // Add data rows
  data.forEach((row) => worksheet.addRow(row));

  return workbook.xlsx.writeBuffer();
};

module.exports = { toBuffer };
