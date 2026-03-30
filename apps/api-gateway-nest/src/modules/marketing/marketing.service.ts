// apps/api-gateway-nest/src/modules/marketing/marketing.service.ts
import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class MarketingService {
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

  analyseFunnel(leads: any[], tenantId: string) {
    return this.post('/marketing/funnel', { leads }, tenantId);
  }

  calcCacLtv(data: Record<string, any>, tenantId: string) {
    return this.post('/marketing/cac-ltv', data, tenantId);
  }

  forecastCampaignRoi(campaign: Record<string, any>, tenantId: string) {
    return this.post('/marketing/campaign-roi', campaign, tenantId);
  }

  analyseSentiment(texts: string[], tenantId: string) {
    return this.post('/marketing/sentiment', { texts }, tenantId);
  }

  segmentAudience(customers: any[], nClusters: number, tenantId: string) {
    return this.post('/marketing/segment', { customers, n_clusters: nClusters }, tenantId);
  }

  suggestBudgetReallocation(channels: any[], tenantId: string) {
    return this.post('/marketing/budget-reallocation', { channels }, tenantId);
  }
}
