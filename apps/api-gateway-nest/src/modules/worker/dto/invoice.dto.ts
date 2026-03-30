// apps/api-gateway-nest/src/modules/worker/dto/invoice.dto.ts
import { IsString, IsArray, IsNumber } from 'class-validator';
export class InvoiceDto {
  @IsString() customerId: string;
  @IsArray() lineItems: any[];
  @IsNumber() subtotal: number;
  @IsNumber() taxTotal: number;
  @IsNumber() total: number;
}
