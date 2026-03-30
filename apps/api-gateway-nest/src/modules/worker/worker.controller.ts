// apps/api-gateway-nest/src/modules/worker/worker.controller.ts
import { Controller, Post, Body } from '@nestjs/common';
import { WorkerService } from './worker.service';
import { ReconcileDto } from './dto/reconcile.dto';
import { EmailDto } from './dto/email.dto';
import { InvoiceDto } from './dto/invoice.dto';

@Controller('worker')
export class WorkerController {
  constructor(private readonly workerService: WorkerService) {}

  @Post('reconcile')
  reconcile(@Body() dto: ReconcileDto) { return this.workerService.reconcileBank(dto); }

  @Post('email')
  sendEmail(@Body() dto: EmailDto) { return this.workerService.sendEmail(dto); }

  @Post('invoice')
  generateInvoice(@Body() dto: InvoiceDto) { return this.workerService.generateInvoice(dto); }
}
