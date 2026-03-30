// apps/api-gateway-nest/src/modules/finance/dto/create-transaction.dto.ts
import { IsArray, IsString, IsOptional, ValidateNested, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class LedgerLineDto {
  @IsString() accountId: string;
  @IsNumber() debit: number;
  @IsNumber() credit: number;
  @IsOptional() @IsString() description?: string;
}

export class CreateTransactionDto {
  @IsArray() @ValidateNested({ each: true }) @Type(() => LedgerLineDto)
  lines: LedgerLineDto[];

  @IsOptional() @IsString() narration?: string;
  @IsOptional() @IsString() sourceType?: string;
  @IsOptional() @IsString() sourceId?: string;
}
