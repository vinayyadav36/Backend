// apps/api-gateway-nest/src/modules/workflows/workflows.service.ts
import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { GstDto } from './dto/gst.dto';
import { ReconcileDto } from './dto/reconcile.dto';
import { InvoiceDto } from './dto/invoice.dto';

@Injectable()
export class WorkflowsService {
  private readonly durableBaseUrl = process.env.DURABLE_URL || 'http://durable-functions:7071';
  constructor(private readonly http: HttpService) {}

  async startGSTWorkflow(dto: GstDto) {
    const res = await firstValueFrom(
      this.http.post(`${this.durableBaseUrl}/orchestrators/gst_filing_orchestrator`, dto),
    );
    return { instanceId: res.data.instanceId };
  }

  async approveGSTWorkflow(instanceId: string) {
    await firstValueFrom(
      this.http.post(`${this.durableBaseUrl}/instances/${instanceId}/raiseEvent/GSTApproval`, { status: 'approved' }),
    );
    return { status: 'approved', instanceId };
  }

  async startReconciliation(dto: ReconcileDto) {
    const res = await firstValueFrom(
      this.http.post(`${this.durableBaseUrl}/orchestrators/reconciliation_orchestrator`, dto),
    );
    return { instanceId: res.data.instanceId };
  }

  async startInvoiceDispatch(dto: InvoiceDto) {
    const res = await firstValueFrom(
      this.http.post(`${this.durableBaseUrl}/orchestrators/invoice_dispatch_orchestrator`, dto),
    );
    return { instanceId: res.data.instanceId };
  }

  async getWorkflowStatus(instanceId: string) {
    const res = await firstValueFrom(
      this.http.get(`${this.durableBaseUrl}/instances/${instanceId}`),
    );
    return res.data;
  }
}
