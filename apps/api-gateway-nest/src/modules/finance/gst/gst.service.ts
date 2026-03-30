// apps/api-gateway-nest/src/modules/finance/gst/gst.service.ts
import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import { DriveService } from '../../reports/integrations/drive.service';

@Injectable()
export class GstService {
  constructor(private readonly driveService: DriveService) {}

  async generateInvoicePdf(invoice: any): Promise<string> {
    const filePath = path.join('/tmp', `invoice-${invoice.invoiceNumber ?? Date.now()}.pdf`);

    await new Promise<void>((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      doc.fontSize(20).text('GST INVOICE', { align: 'center' });
      doc.moveDown();
      doc.fontSize(12)
        .text(`Invoice No : ${invoice.invoiceNumber}`)
        .text(`Customer   : ${invoice.customerId}`)
        .text(`Issue Date : ${invoice.issueDate}`)
        .text(`Due Date   : ${invoice.dueDate}`);

      doc.moveDown();
      doc.fontSize(11).text('Line Items:', { underline: true });
      (invoice.lineItems || []).forEach((item: any) => {
        doc.text(`  ${item.name ?? item.description} — Qty: ${item.qty ?? item.quantity} × ₹${item.price ?? item.rate}`);
      });

      doc.moveDown();
      doc.text(`Subtotal  : ₹${invoice.subtotal}`)
        .text(`GST       : ₹${invoice.taxTotal}`)
        .text(`Grand Total: ₹${invoice.total}`, { bold: true });

      doc.end();
      stream.on('finish', resolve);
      stream.on('error', reject);
    });

    return filePath;
  }

  async generateInvoiceExcel(invoice: any): Promise<string> {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('GST Invoice');

    ws.columns = [
      { header: 'Field', key: 'field', width: 20 },
      { header: 'Value', key: 'value', width: 30 },
    ];

    const rows = [
      { field: 'Invoice Number', value: invoice.invoiceNumber },
      { field: 'Customer ID',   value: invoice.customerId },
      { field: 'Issue Date',    value: invoice.issueDate },
      { field: 'Due Date',      value: invoice.dueDate },
      { field: 'Subtotal',      value: invoice.subtotal },
      { field: 'GST Total',     value: invoice.taxTotal },
      { field: 'Grand Total',   value: invoice.total },
    ];

    rows.forEach((r) => ws.addRow(r));

    // Bold the header row
    ws.getRow(1).font = { bold: true };

    const filePath = path.join('/tmp', `invoice-${invoice.invoiceNumber ?? Date.now()}.xlsx`);
    await wb.xlsx.writeFile(filePath);
    return filePath;
  }

  async exportInvoice(invoice: any, format: 'pdf' | 'excel'): Promise<{ link: string }> {
    const filePath =
      format === 'pdf'
        ? await this.generateInvoicePdf(invoice)
        : await this.generateInvoiceExcel(invoice);

    const ext = format === 'pdf' ? 'pdf' : 'xlsx';
    const link = await this.driveService.uploadFile(
      filePath,
      `Invoice-${invoice.invoiceNumber}.${ext}`,
      format === 'pdf' ? 'application/pdf'
        : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );

    return { link };
  }
}
