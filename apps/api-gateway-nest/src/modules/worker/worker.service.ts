// apps/api-gateway-nest/src/modules/worker/worker.service.ts
import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { ReconcileDto } from './dto/reconcile.dto';
import { EmailDto } from './dto/email.dto';
import { InvoiceDto } from './dto/invoice.dto';

@Injectable()
export class WorkerService {
  private readonly workerBaseUrl = process.env.WORKER_URL || 'http://worker-service:4000';
  constructor(private readonly http: HttpService) {}

  async reconcileBank(dto: ReconcileDto) {
    const res = await firstValueFrom(this.http.post(`${this.workerBaseUrl}/reconcile`, dto));
    return res.data;
  }

  async sendEmail(dto: EmailDto) {
    const res = await firstValueFrom(this.http.post(`${this.workerBaseUrl}/email/send`, dto));
    return res.data;
  }

  async generateInvoice(dto: InvoiceDto) {
    const res = await firstValueFrom(this.http.post(`${this.workerBaseUrl}/invoice/generate`, dto));
    return res.data;
  }
}
