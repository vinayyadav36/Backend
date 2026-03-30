// apps/api-gateway-nest/src/modules/reports/reports.controller.ts
import {
  Controller, Get, Post, Query, Req, UseInterceptors, UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ReportsService } from './reports.service';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  /** GET /reports/finance/overview */
  @Get('finance/overview')
  getFinanceOverview(@Req() req: any) {
    return this.reportsService.getFinanceOverview(req.tenantId);
  }

  /** GET /reports/finance/budget-vs-actual?period=YYYY-MM */
  @Get('finance/budget-vs-actual')
  getBudgetVsActual(@Req() req: any, @Query('period') period?: string) {
    return this.reportsService.getBudgetVsActual(req.tenantId, period);
  }

  /** POST /reports/finance/export — export to Excel + Drive */
  @Post('finance/export')
  exportFinance(@Req() req: any) {
    return this.reportsService.exportFinanceToExcel(req.tenantId);
  }

  /** POST /reports/finance/import — upload budget.xlsx */
  @Post('finance/import')
  @UseInterceptors(FileInterceptor('file'))
  importBudget(@UploadedFile() file: Express.Multer.File, @Req() req: any) {
    return this.reportsService.parseBudgetFile(file.buffer);
  }
}
