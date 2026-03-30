// apps/api-gateway-nest/src/modules/workflows/dto/reconcile.dto.ts
import { IsArray } from 'class-validator';
export class ReconcileDto {
  @IsArray() transactions: any[];
  @IsArray() invoices: any[];
}
