// libs/integrations/excel/excel-generator.ts
import * as ExcelJS from 'exceljs';

/**
 * ExcelGenerator
 * Generates Excel workbooks (P&L, Finance, Budgets) for export and Drive sync.
 */
export class ExcelGenerator {
  /**
   * Build an XLSX buffer from a flat array of objects.
   *
   * @param data       Array of plain objects — each key becomes a column header
   * @param sheetName  Worksheet tab label
   */
  static async toBuffer(data: Record<string, unknown>[], sheetName = 'Report'): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Jarvis ERP';
    wb.created = new Date();

    const ws = wb.addWorksheet(sheetName);

    if (!data.length) {
      ws.addRow(['No data available']);
      return (await wb.xlsx.writeBuffer()) as Buffer;
    }

    ws.columns = Object.keys(data[0]).map((key) => ({
      header: key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      key,
      width: 22,
    }));

    // Style header row
    const headerRow = ws.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E3A5F' },
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

    data.forEach((row) => ws.addRow(row));

    return (await wb.xlsx.writeBuffer()) as Buffer;
  }

  /**
   * Parse an uploaded budget XLSX file and return structured rows.
   *
   * @param buffer  Raw file buffer from Multer
   */
  static async parseBudgetFile(
    buffer: Buffer,
  ): Promise<Array<{ category: string; amount: number; month: string }>> {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);

    const ws = wb.worksheets[0];
    if (!ws) throw new Error('No worksheet found in the uploaded file');

    const rows: Array<{ category: string; amount: number; month: string }> = [];

    ws.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // skip header
      const category = String(row.getCell(1).value ?? '').trim();
      const amount = parseFloat(String(row.getCell(2).value ?? '0'));
      const month = String(row.getCell(3).value ?? '').trim();
      if (category) rows.push({ category, amount, month });
    });

    return rows;
  }
}
