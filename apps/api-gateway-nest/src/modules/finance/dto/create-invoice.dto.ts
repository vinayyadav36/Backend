// apps/api-gateway-nest/src/modules/finance/dto/create-invoice.dto.ts
import { IsString, IsNumber, IsArray, IsOptional } from 'class-validator';

export class CreateInvoiceDto {
  @IsString() customerId: string;
  @IsString() issueDate: string;
  @IsString() dueDate: string;
  @IsArray() lineItems: any[];
  @IsNumber() subtotal: number;
  @IsNumber() gstRate: number;   // percentage, e.g. 18 for 18 % GST
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsString() narration?: string;
}
