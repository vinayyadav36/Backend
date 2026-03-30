// apps/api-gateway-nest/src/ml-bridge/ml-bridge.service.ts
import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

/** MlBridgeService — low-level proxy to the FastAPI ML agent, used by other NestJS services. */
@Injectable()
export class MlBridgeService {
  private readonly baseUrl = process.env.ML_AGENT_URL || 'http://ml-agent:8000';
  constructor(private readonly http: HttpService) {}

  async post<T = any>(path: string, data: any, tenantId: string): Promise<T> {
    const res = await firstValueFrom(
      this.http.post<T>(`${this.baseUrl}${path}`, data, {
        headers: { 'x-tenant-id': tenantId },
        timeout: 60000,
      }),
    );
    return res.data;
  }

  async get<T = any>(path: string, tenantId: string): Promise<T> {
    const res = await firstValueFrom(
      this.http.get<T>(`${this.baseUrl}${path}`, {
        headers: { 'x-tenant-id': tenantId },
      }),
    );
    return res.data;
  }
}
