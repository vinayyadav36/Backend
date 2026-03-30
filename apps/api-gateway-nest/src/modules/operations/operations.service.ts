// apps/api-gateway-nest/src/modules/operations/operations.service.ts
import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class OperationsService {
  private readonly mlUrl = process.env.ML_AGENT_URL || 'http://ml-agent:8000';

  constructor(private readonly http: HttpService) {}

  private async post(path: string, body: any, tenantId: string) {
    const res = await firstValueFrom(
      this.http.post(`${this.mlUrl}${path}`, body, {
        headers: { 'x-tenant-id': tenantId },
      }),
    );
    return res.data;
  }

  optimiseInventory(
    inventory: any[],
    salesPipelineSignal: number,
    cashFlowSignal: number,
    tenantId: string,
  ) {
    return this.post(
      '/operations/inventory',
      { inventory, sales_pipeline_signal: salesPipelineSignal, cash_flow_signal: cashFlowSignal },
      tenantId,
    );
  }

  predictVendorLeadTime(vendors: any[], tenantId: string) {
    return this.post('/operations/vendor-leadtime', { vendors }, tenantId);
  }

  monitorSla(tickets: any[], tenantId: string) {
    return this.post('/operations/sla', { tickets }, tenantId);
  }

  triggerRestock(restockItems: any[], tenantId: string) {
    return this.post('/operations/restock', { restock_items: restockItems }, tenantId);
  }
}
