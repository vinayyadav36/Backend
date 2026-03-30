// apps/api-gateway-nest/src/modules/super-agent/super-agent.service.ts
import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class SuperAgentService {
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

  /**
   * Executive Dashboard — all four brains in one call.
   * Returns unified KPIs + boardroom alerts.
   */
  executiveDashboard(payload: Record<string, any>, tenantId: string) {
    return this.post('/super-agent/dashboard', payload, tenantId);
  }

  /**
   * What-if scenario simulation.
   * Runs base, optimistic, pessimistic, stress_test and compares outcomes.
   */
  scenarioSimulation(
    basePayload: Record<string, any>,
    scenarios: string[],
    tenantId: string,
  ) {
    return this.post(
      '/super-agent/scenario',
      { base_payload: basePayload, scenarios },
      tenantId,
    );
  }
}
