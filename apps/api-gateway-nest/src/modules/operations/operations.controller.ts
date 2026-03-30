// apps/api-gateway-nest/src/modules/operations/operations.controller.ts
import { Controller, Post, Get, Body, Req } from '@nestjs/common';
import { OperationsService } from './operations.service';

@Controller('operations')
export class OperationsController {
  constructor(private readonly opsService: OperationsService) {}

  /** POST /operations/inventory — EOQ-based inventory optimisation */
  @Post('inventory')
  optimiseInventory(@Body() body: any, @Req() req: any) {
    return this.opsService.optimiseInventory(
      body.inventory,
      body.sales_pipeline_signal ?? 1.0,
      body.cash_flow_signal ?? 1.0,
      req.tenantId,
    );
  }

  /** POST /operations/vendor-leadtime — vendor delivery risk prediction */
  @Post('vendor-leadtime')
  predictVendorLeadTime(@Body('vendors') vendors: any[], @Req() req: any) {
    return this.opsService.predictVendorLeadTime(vendors, req.tenantId);
  }

  /** POST /operations/sla — SLA breach detection + alerts */
  @Post('sla')
  monitorSla(@Body('tickets') tickets: any[], @Req() req: any) {
    return this.opsService.monitorSla(tickets, req.tenantId);
  }

  /** POST /operations/restock — trigger restock workflow (pending_tasks) */
  @Post('restock')
  triggerRestock(@Body('restock_items') items: any[], @Req() req: any) {
    return this.opsService.triggerRestock(items, req.tenantId);
  }
}
