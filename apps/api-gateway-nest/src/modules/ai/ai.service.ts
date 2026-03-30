// apps/api-gateway-nest/src/modules/ai/ai.service.ts
import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { ForecastDto } from './dto/forecast.dto';
import { AnomalyDto } from './dto/anomaly.dto';
import { LeadScoreDto } from './dto/lead-score.dto';
import { AgentDto } from './dto/agent.dto';

@Injectable()
export class AiService {
  private readonly mlBaseUrl = process.env.ML_AGENT_URL || 'http://ml-agent:8000';

  constructor(private readonly http: HttpService) {}

  private headers(tenantId: string) {
    return { 'x-tenant-id': tenantId };
  }

  async getEmbedding(text: string, tenantId: string) {
    const res = await firstValueFrom(
      this.http.post(`${this.mlBaseUrl}/embeddings`, { text }, { headers: this.headers(tenantId) }),
    );
    return res.data;
  }

  async forecastRevenue(dto: ForecastDto, tenantId: string) {
    const res = await firstValueFrom(
      this.http.post(`${this.mlBaseUrl}/ai/forecast/revenue`, dto, { headers: this.headers(tenantId) }),
    );
    return res.data;
  }

  async detectAnomalies(dto: AnomalyDto, tenantId: string) {
    const res = await firstValueFrom(
      this.http.post(`${this.mlBaseUrl}/anomaly`, dto, { headers: this.headers(tenantId) }),
    );
    return res.data;
  }

  async scoreLead(dto: LeadScoreDto, tenantId: string) {
    const res = await firstValueFrom(
      this.http.post(`${this.mlBaseUrl}/lead/score`, dto, { headers: this.headers(tenantId) }),
    );
    return res.data;
  }

  async runAgent(dto: AgentDto, tenantId: string) {
    const res = await firstValueFrom(
      this.http.post(`${this.mlBaseUrl}/ai/agent/ask`, dto, { headers: this.headers(tenantId) }),
    );
    return res.data;
  }
}
