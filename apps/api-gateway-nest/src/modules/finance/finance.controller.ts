// apps/api-gateway-nest/src/modules/finance/finance.controller.ts
import { Controller, Post, Get, Body, Req } from '@nestjs/common';
import { FinanceService } from './finance.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { CreateInvoiceDto } from './dto/create-invoice.dto';

@Controller('finance')
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  /** POST /finance/transaction — post a balanced journal entry */
  @Post('transaction')
  createTransaction(@Body() dto: CreateTransactionDto, @Req() req: any) {
    return this.financeService.createTransaction(req.tenantId, dto);
  }

  /** POST /finance/invoice — create GST invoice + auto journal entry */
  @Post('invoice')
  createInvoice(@Body() dto: CreateInvoiceDto, @Req() req: any) {
    return this.financeService.createGstInvoice(req.tenantId, dto);
  }

  /** GET /finance/summary — account balances for the tenant */
  @Get('summary')
  getSummary(@Req() req: any) {
    return this.financeService.getFinanceSummary(req.tenantId);
  }
}
