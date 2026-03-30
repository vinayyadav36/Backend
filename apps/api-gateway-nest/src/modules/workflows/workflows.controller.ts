// apps/api-gateway-nest/src/modules/workflows/workflows.controller.ts
import { Controller, Post, Get, Body, Param } from '@nestjs/common';
import { WorkflowsService } from './workflows.service';
import { GstDto } from './dto/gst.dto';
import { ReconcileDto } from './dto/reconcile.dto';
import { InvoiceDto } from './dto/invoice.dto';

@Controller('workflows')
export class WorkflowsController {
  constructor(private readonly workflowsService: WorkflowsService) {}

  @Post('gst/start') startGST(@Body() dto: GstDto) { return this.workflowsService.startGSTWorkflow(dto); }
  @Post('gst/approve/:id') approveGST(@Param('id') id: string) { return this.workflowsService.approveGSTWorkflow(id); }
  @Post('reconcile/start') startReconcile(@Body() dto: ReconcileDto) { return this.workflowsService.startReconciliation(dto); }
  @Post('invoice/start') startInvoice(@Body() dto: InvoiceDto) { return this.workflowsService.startInvoiceDispatch(dto); }
  @Get('status/:id') getStatus(@Param('id') id: string) { return this.workflowsService.getWorkflowStatus(id); }
}
