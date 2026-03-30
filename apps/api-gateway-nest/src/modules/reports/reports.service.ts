// apps/api-gateway-nest/src/modules/reports/reports.service.ts
import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ExcelGenerator } from '@libs/integrations/excel/excel-generator';
import { DriveService } from './integrations/drive.service';

@Injectable()
export class ReportsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly driveService: DriveService,
  ) {}

  /** Finance overview — monthly revenue vs GST liability from Postgres */
  async getFinanceOverview(tenantId: string) {
    return this.dataSource.query(
      `SELECT
         tenant_id,
         DATE_TRUNC('month', timestamp) AS month,
         SUM(CASE WHEN credit_account_id = 'REVENUE' THEN amount ELSE 0 END) AS total_revenue,
         SUM(COALESCE(tax_amount, 0)) AS total_gst_payable
       FROM journal_entries
       WHERE tenant_id = $1
       GROUP BY 1, 2
       ORDER BY 2 DESC`,
      [tenantId],
    );
  }

  /** Budget vs actual from the view_budget_variance view */
  async getBudgetVsActual(tenantId: string, period?: string) {
    return this.dataSource.query(
      `SELECT * FROM view_budget_variance WHERE tenant_id = $1 ${period ? 'AND month_year = $2' : ''} ORDER BY month_year DESC`,
      period ? [tenantId, period] : [tenantId],
    );
  }

  /** Export finance overview to Excel, upload to Drive, return link */
  async exportFinanceToExcel(tenantId: string): Promise<{ link: string }> {
    const data = await this.getFinanceOverview(tenantId);
    const buffer = await ExcelGenerator.toBuffer(data, 'Finance Overview');
    const link = await this.driveService.uploadBuffer(
      buffer,
      `Finance-Overview-${tenantId}-${Date.now()}.xlsx`,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    return { link };
  }

  /** Parse uploaded budget XLSX and return structured rows */
  async parseBudgetFile(buffer: Buffer) {
    return ExcelGenerator.parseBudgetFile(buffer);
  }
}
