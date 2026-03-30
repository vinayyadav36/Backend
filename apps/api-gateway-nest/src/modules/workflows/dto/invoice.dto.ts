// apps/api-gateway-nest/src/modules/workflows/dto/invoice.dto.ts
import { IsString } from 'class-validator';
export class InvoiceDto { @IsString() invoiceId: string; }
