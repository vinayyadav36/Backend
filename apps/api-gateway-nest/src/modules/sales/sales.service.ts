// apps/api-gateway-nest/src/modules/sales/sales.service.ts
import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class SalesService {
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

  scoreLeads(leads: any[], tenantId: string) {
    return this.post('/sales/lead-score', { leads }, tenantId);
  }

  forecastPipeline(deals: any[], tenantId: string) {
    return this.post('/sales/pipeline', { deals }, tenantId);
  }

  suggestPricing(products: any[], tenantId: string) {
    return this.post('/sales/pricing', { products }, tenantId);
  }

  generateContract(dealData: Record<string, any>, tenantId: string) {
    return this.post('/sales/contract', dealData, tenantId);
  }
}
